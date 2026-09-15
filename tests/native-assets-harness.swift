import CryptoKit
import Foundation

private enum HarnessFailure: Error { case assertion(String) }

private func require(_ condition: @autoclosure () -> Bool, _ message: String) throws {
    guard condition() else { throw HarnessFailure.assertion(message) }
}

private func digest(_ data: Data) -> String {
    SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
}

private func file(_ path: String, _ data: Data, url: String? = nil) -> NativeAssetFile {
    NativeAssetFile(path: path, bytes: Int64(data.count), sha256: digest(data), url: url)
}

private func manifest(_ room: String, _ version: String, _ files: [NativeAssetFile], shared: [String] = [], total: Int64, licenseStatus: String? = "fixture-local") -> NativeAssetManifest {
    NativeAssetManifest(schemaVersion: 1, appSchemaVersion: 1, roomId: room, assetVersion: version, minAppVersion: nil, totalBytes: total, files: files, sharedAssets: shared, provenance: "native-assets-harness", licenseStatus: licenseStatus)
}

@main
struct NativeAssetsHarness {
    static func main() async {
        do {
            let environment = ProcessInfo.processInfo.environment
            guard let rootPath = environment["NATIVE_ASSET_ROOT"], let base = environment["NATIVE_ASSET_BASE_URL"] else { throw HarnessFailure.assertion("missing test environment") }
            let root = URL(fileURLWithPath: rootPath, isDirectory: true)
            let store = try NativeAssetStore(testRoot: root)
            let sharedData = Data(repeating: 0x53, count: 32 * 1024)
            let aData = Data(repeating: 0x41, count: 16 * 1024)
            let bData = Data(repeating: 0x42, count: 16 * 1024)
            let replacementData = Data(repeating: 0x43, count: 16 * 1024)
            let badData = Data(repeating: 0x58, count: 16 * 1024)
            let shared = file("shared.bin", sharedData)
            let roomAFile = file("a.bin", aData)
            let roomBFile = file("b.bin", bData)
            let roomANewFile = file("new.bin", replacementData)

            let roomA = manifest("room-a", "v1", [roomAFile], shared: [shared.path], total: roomAFile.bytes + shared.bytes)
            _ = try await store.install(manifest: roomA, sharedFiles: [shared], baseURL: URL(string: base)!) { _, _, _, _ in }
            let first = try store.resolved(roomId: "room-a")
            try require(first["assetVersion"] as? String == "v1", "initial install must become active")
            let initialReceipt = first["manifest"] as? [String: Any]
            try require(initialReceipt?["licenseStatus"] as? String == "fixture-local", "installed receipt must retain licenseStatus")

            let roomB = manifest("room-b", "v1", [roomBFile], shared: [shared.path], total: roomBFile.bytes + shared.bytes)
            _ = try await store.install(manifest: roomB, sharedFiles: [shared], baseURL: URL(string: base)!) { _, _, _, _ in }

            // Corrupt the shared object inode. Existing room links become invalid;
            // redownloading the same receipt must repair the requested active room.
            let objectURL = root.appendingPathComponent("QuietPlacesAssets/objects/\(shared.sha256)")
            let corruptHandle = try FileHandle(forWritingTo: objectURL)
            try corruptHandle.write(contentsOf: Data(repeating: 0x58, count: sharedData.count))
            try corruptHandle.close()
            _ = try await store.install(manifest: roomA, sharedFiles: [shared], baseURL: URL(string: base)!) { _, _, _, _ in }
            let repairedA = try store.resolved(roomId: "room-a")
            try require(repairedA["assetVersion"] as? String == "v1", "same-version redownload must repair the active room")
            let roomBInvalid = (try? store.resolved(roomId: "room-b")) == nil
            try require(roomBInvalid, "other room retaining corrupt shared inode must be invalid")
            _ = try await store.install(manifest: roomB, sharedFiles: [shared], baseURL: URL(string: base)!) { _, _, _, _ in }
            let repairedB = try store.resolved(roomId: "room-b")
            try require(repairedB["assetVersion"] as? String == "v1", "same-version redownload must repair other shared receipt")

            let zeroCapacityStore = try NativeAssetStore(testRoot: root, capacityProvider: { 0 })
            let capacityRejected: Bool
            do { _ = try await zeroCapacityStore.install(manifest: manifest("room-a", "v-capacity", [roomANewFile], total: roomANewFile.bytes), sharedFiles: [], baseURL: URL(string: base)!) { _, _, _, _ in }; capacityRejected = false }
            catch { capacityRejected = true }
            try require(capacityRejected, "zero-capacity store unexpectedly installed")
            let afterCapacityFailure = try store.resolved(roomId: "room-a")
            try require(afterCapacityFailure["assetVersion"] as? String == "v1", "capacity rejection must preserve old active version")

            let bad = NativeAssetFile(path: "bad.bin", bytes: Int64(badData.count), sha256: roomANewFile.sha256, url: nil)
            let failingUpdate = manifest("room-a", "v2", [bad], total: bad.bytes)
            let updateFailed: Bool
            do { _ = try await store.install(manifest: failingUpdate, sharedFiles: [], baseURL: URL(string: base)!) { _, _, _, _ in }; updateFailed = false }
            catch { updateFailed = true }
            try require(updateFailed, "hash mismatch update unexpectedly installed")
            let afterFailedUpdate = try store.resolved(roomId: "room-a")
            try require(afterFailedUpdate["assetVersion"] as? String == "v1", "failed update must retain old active version")

            let updated = manifest("room-a", "v2", [roomANewFile], total: roomANewFile.bytes)
            _ = try await store.install(manifest: updated, sharedFiles: [], baseURL: URL(string: base)!) { _, _, _, _ in }
            let afterUpdate = try store.resolved(roomId: "room-a")
            try require(afterUpdate["assetVersion"] as? String == "v2", "new version must activate")
            let afterRollback = try store.rollback(roomId: "room-a")
            try require(afterRollback["assetVersion"] as? String == "v1", "rollback must restore compatible old version")

            let traversal = manifest("traversal", "v1", [NativeAssetFile(path: "../escape.bin", bytes: 1, sha256: digest(Data([1])), url: nil)], total: 1)
            let traversalRejected: Bool
            do { _ = try await store.install(manifest: traversal, sharedFiles: [], baseURL: URL(string: base)!) { _, _, _, _ in }; traversalRejected = false }
            catch { traversalRejected = true }
            try require(traversalRejected, "traversal manifest unexpectedly installed")
            let duplicate = manifest("duplicate", "v1", [roomAFile], shared: [roomAFile.path], total: roomAFile.bytes * 2)
            let duplicateRejected: Bool
            do { _ = try await store.install(manifest: duplicate, sharedFiles: [roomAFile], baseURL: URL(string: base)!) { _, _, _, _ in }; duplicateRejected = false }
            catch { duplicateRejected = true }
            try require(duplicateRejected, "duplicate path manifest unexpectedly installed")
            let oversized = manifest("oversized", "v1", [NativeAssetFile(path: "a.bin", bytes: 1, sha256: digest(Data([0])), url: nil)], total: 1)
            let oversizedRejected: Bool
            do { _ = try await store.install(manifest: oversized, sharedFiles: [], baseURL: URL(string: base)!) { _, _, _, _ in }; oversizedRejected = false }
            catch { oversizedRejected = true }
            try require(oversizedRejected, "oversized response unexpectedly installed")

            let slowData = Data(repeating: 0x44, count: 2 * 1024 * 1024)
            let slow = file("slow.bin", slowData)
            let cancelling = manifest("cancelled", "v1", [slow], total: slow.bytes)
            let task: Task<Void, Error> = Task { _ = try await store.install(manifest: cancelling, sharedFiles: [], baseURL: URL(string: base)!) { _, _, _, _ in } }
            try await Task.sleep(for: .milliseconds(80))
            task.cancel()
            _ = try? await task.value
            let cancelledActive = (try? store.resolved(roomId: "cancelled")) != nil
            try require(!cancelledActive, "cancelled download became active")

            try store.remove(roomId: "room-a")
            let remaining = try store.resolved(roomId: "room-b")
            try require(remaining["assetVersion"] as? String == "v1", "removing one room must retain shared dependency for another")
            try store.remove(roomId: "room-b")
            try require(store.retainedBytes() == 0, "removing final shared reference must reclaim object store")
            print("NATIVE_ASSET_HARNESS_PASS")
        } catch {
            fputs("NATIVE_ASSET_HARNESS_FAIL: \(error)\n", stderr)
            exit(1)
        }
    }
}
