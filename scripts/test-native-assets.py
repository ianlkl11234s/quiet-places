#!/usr/bin/env python3
"""Compile and run the actual NativeAssetStore against a local HTTP fixture."""
from __future__ import annotations

import hashlib
import http.server
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLUGIN = ROOT / "ios/App/App/NativeAssetsPlugin.swift"
HARNESS = ROOT / "tests/native-assets-harness.swift"
EVIDENCE = ROOT / "exports/p8/2026-09-14-p82-p85/native-assets-harness.log"

PAYLOADS = {
    "/shared.bin": b"S" * (32 * 1024),
    "/a.bin": b"A" * (16 * 1024),
    "/b.bin": b"B" * (16 * 1024),
    "/new.bin": b"C" * (16 * 1024),
    "/bad.bin": b"X" * (16 * 1024),
    "/slow.bin": b"D" * (2 * 1024 * 1024),
}


class Fixture(http.server.BaseHTTPRequestHandler):
    hits: dict[str, int] = {}

    def do_GET(self) -> None:
        payload = PAYLOADS.get(self.path)
        if payload is None:
            self.send_error(404)
            return
        self.hits[self.path] = self.hits.get(self.path, 0) + 1
        self.send_response(200)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        if self.path == "/slow.bin":
            try:
                for start in range(0, len(payload), 4096):
                    self.wfile.write(payload[start : start + 4096])
                    self.wfile.flush()
                    threading.Event().wait(0.004)
            except BrokenPipeError:
                # Expected when the cancellation regression case closes its request.
                return
        else:
            self.wfile.write(payload)

    def log_message(self, *_: object) -> None:
        pass


def extract_store(destination: Path) -> None:
    source = PLUGIN.read_text()
    before_bridge, marker, _ = source.partition("@objc(NativeAssetsPlugin)")
    if not marker or "private final class NativeAssetStore" not in before_bridge:
        raise RuntimeError("NativeAssetStore extraction boundary changed")
    before_bridge = before_bridge.replace("import Capacitor\n", "")
    before_bridge = before_bridge.replace("#if targetEnvironment(simulator)", "#if os(macOS) || targetEnvironment(simulator)")
    original_init = re.compile(r"    init\(\) throws \{.*?\n    \}\n\n    private var objectsDirectory", re.S)
    replacement = '''    init(testRoot: URL, capacityProvider: @escaping () -> Int64? = { nil }) throws {
        self.capacityProvider = capacityProvider
        root = testRoot.appendingPathComponent("QuietPlacesAssets", isDirectory: true)
        try makeDirectory(root)
        try makeDirectory(objectsDirectory)
        try makeDirectory(roomsDirectory)
        try makeDirectory(stagingDirectory)
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var mutableRoot = root
        try mutableRoot.setResourceValues(values)
        try? fileManager.removeItem(at: stagingDirectory)
        try makeDirectory(stagingDirectory)
    }

    private var objectsDirectory'''
    extracted, count = original_init.subn(replacement, before_bridge, count=1)
    if count != 1:
        raise RuntimeError("NativeAssetStore init extraction boundary changed")
    destination.write_text(extracted)


def main() -> int:
    work = Path(tempfile.mkdtemp(prefix="quiet-places-native-assets-"))
    try:
        store = work / "NativeAssetStore.swift"
        combined = work / "NativeAssetStoreHarness.swift"
        binary = work / "native-assets-harness"
        extract_store(store)
        # The extracted types remain `private` in production. Concatenating the test
        # driver makes that privacy boundary file-local without widening app code.
        combined.write_text(store.read_text() + "\n" + HARNESS.read_text())
        compile_result = subprocess.run(["swiftc", "-parse-as-library", str(combined), "-o", str(binary)], text=True, capture_output=True)
        if compile_result.returncode:
            raise RuntimeError(f"swiftc failed\n{compile_result.stdout}\n{compile_result.stderr}")
        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Fixture)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        environment = os.environ | {
            "NATIVE_ASSET_ROOT": str(work / "storage"),
            "NATIVE_ASSET_BASE_URL": f"http://127.0.0.1:{server.server_port}",
            "NATIVE_ASSET_HITS_FILE": str(work / "hits"),
        }
        result = subprocess.run([str(binary)], text=True, capture_output=True, env=environment)
        server.shutdown()
        thread.join(timeout=2)
        # room-b reuses the first verified shared object. One extra fetch is expected
        # only after the harness deliberately corrupts that object to test repair.
        if Fixture.hits.get("/shared.bin") != 2:
            result = subprocess.CompletedProcess(result.args, 1, result.stdout, result.stderr + f"\nshared.bin fetched {Fixture.hits.get('/shared.bin', 0)} times")
        transcript = f"$ swiftc extracted NativeAssetStore + native-assets-harness.swift\n{result.stdout}{result.stderr}\nfixture hits={Fixture.hits}\n"
        EVIDENCE.parent.mkdir(parents=True, exist_ok=True)
        EVIDENCE.write_text(transcript)
        sys.stdout.write(transcript)
        return result.returncode
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
