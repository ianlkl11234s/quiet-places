import Capacitor
import CryptoKit
import Foundation

private struct NativeAssetFile: Codable, Equatable {
    let path: String
    let bytes: Int64
    let sha256: String
    let url: String?
}

private struct NativeAssetManifest: Codable, Equatable {
    let schemaVersion: Int
    let appSchemaVersion: Int
    let roomId: String
    let assetVersion: String
    let minAppVersion: String?
    let totalBytes: Int64
    let files: [NativeAssetFile]
    let sharedAssets: [String]
    let provenance: String?
    let licenseStatus: String?
}

private struct ActiveAssetVersion: Codable {
    let roomId: String
    let assetVersion: String
    let installedAt: Date
}

private enum NativeAssetError: LocalizedError {
    case invalid(String)
    case verification(String)
    case network(String)

    var errorDescription: String? {
        switch self {
        case .invalid(let message), .verification(let message), .network(let message): return message
        }
    }
}

/// Durable, app-owned room asset storage. Bundled pilot files deliberately remain outside this store.
private final class NativeAssetStore {
    private let fileManager = FileManager.default
    private let root: URL
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()
    private let capacityProvider: (() -> Int64?)?

    init() throws {
        capacityProvider = nil
        let applicationSupport = try fileManager.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        root = applicationSupport.appendingPathComponent("QuietPlacesAssets", isDirectory: true)
        try makeDirectory(root)
        try makeDirectory(objectsDirectory)
        try makeDirectory(roomsDirectory)
        try makeDirectory(stagingDirectory)
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var mutableRoot = root
        try mutableRoot.setResourceValues(values)
        // Staging directories can only contain incomplete, non-active versions.
        try? fileManager.removeItem(at: stagingDirectory)
        try makeDirectory(stagingDirectory)
    }

    private var objectsDirectory: URL { root.appendingPathComponent("objects", isDirectory: true) }
    private var roomsDirectory: URL { root.appendingPathComponent("rooms", isDirectory: true) }
    private var stagingDirectory: URL { root.appendingPathComponent("staging", isDirectory: true) }

    func install(
        manifest: NativeAssetManifest,
        sharedFiles: [NativeAssetFile],
        baseURL: URL,
        progress: @escaping (String, Int64, Int64, String?) -> Void
    ) async throws -> [String: Any] {
        try validate(manifest: manifest)
        let files = try resolvedFiles(manifest: manifest, sharedFiles: sharedFiles)
        let total = files.reduce(Int64(0)) { $0 + $1.bytes }
        guard total == manifest.totalBytes else {
            throw NativeAssetError.invalid("Manifest totalBytes does not match its complete dependency set")
        }
        try preflightCapacity(files: files, totalBytes: total)
        let transaction = UUID().uuidString.lowercased()
        let staging = stagingDirectory.appendingPathComponent(transaction, isDirectory: true)
        let downloaded = staging.appendingPathComponent("downloads", isDirectory: true)
        let version = staging.appendingPathComponent("version", isDirectory: true)
        defer { try? fileManager.removeItem(at: staging) }
        try makeDirectory(downloaded)
        try makeDirectory(version.appendingPathComponent("files", isDirectory: true))

        var bytesDownloaded: Int64 = 0
        for file in files {
            let object = objectsDirectory.appendingPathComponent(file.sha256.lowercased())
            let destination = try safeFileURL(root: version.appendingPathComponent("files", isDirectory: true), relativePath: file.path)
            try makeDirectory(destination.deletingLastPathComponent())
            // Shared audio and models are content-addressed. Verify before reuse so a
            // corrupt cache cannot turn a successful install into a silent bad room.
            if fileManager.fileExists(atPath: object.path), (try? verify(file: file, at: object)) != nil {
                try linkOrCopy(object, to: destination)
                bytesDownloaded += file.bytes
                progress("verifying", bytesDownloaded, total, file.path)
                continue
            }
            progress("downloading", bytesDownloaded, total, file.path)
            let remoteURL = try downloadURL(for: file, baseURL: baseURL)
            let temporary = downloaded.appendingPathComponent(UUID().uuidString.lowercased())
            try await stream(remoteURL, to: temporary, expected: file, total: total) { increment in
                bytesDownloaded += increment
                progress("downloading", bytesDownloaded, total, file.path)
            }
            progress("verifying", bytesDownloaded, total, file.path)
            if fileManager.fileExists(atPath: object.path) {
                // The pre-download verification failed; replace only with the just
                // verified staging file, never delete the cache before a replacement.
                _ = try fileManager.replaceItemAt(object, withItemAt: temporary)
            } else {
                try fileManager.moveItem(at: temporary, to: object)
            }
            try excludeFromBackup(object)
            try linkOrCopy(object, to: destination)
        }
        // Persist the fully expanded dependency set. The remote manifest retains sharedAssets
        // for provenance, while this installed receipt is sufficient to resolve and retain files.
        let installedManifest = NativeAssetManifest(
            schemaVersion: manifest.schemaVersion,
            appSchemaVersion: manifest.appSchemaVersion,
            roomId: manifest.roomId,
            assetVersion: manifest.assetVersion,
            minAppVersion: manifest.minAppVersion,
            totalBytes: manifest.totalBytes,
            files: files,
            sharedAssets: manifest.sharedAssets,
            provenance: manifest.provenance,
            licenseStatus: manifest.licenseStatus
        )
        try encoder.encode(installedManifest).write(to: version.appendingPathComponent("manifest.json"), options: .atomic)
        try Task.checkCancellation()
        try activate(stagedVersion: version, manifest: manifest)
        progress("ready", total, total, nil)
        return try resolved(roomId: manifest.roomId)
    }

    func resolved(roomId: String) throws -> [String: Any] {
        let active = try activeVersion(roomId: roomId)
        let versionRoot = roomsDirectory
            .appendingPathComponent(active.roomId, isDirectory: true)
            .appendingPathComponent("versions", isDirectory: true)
            .appendingPathComponent(active.assetVersion, isDirectory: true)
        let manifest = try decoder.decode(NativeAssetManifest.self, from: Data(contentsOf: versionRoot.appendingPathComponent("manifest.json")))
        try validateInstalled(manifest, versionRoot: versionRoot)
        var urls: [String: String] = [:]
        for file in manifest.files {
            urls[file.path] = try safeFileURL(root: versionRoot.appendingPathComponent("files", isDirectory: true), relativePath: file.path).absoluteString
        }
        let manifestObject = try JSONSerialization.jsonObject(with: encoder.encode(manifest))
        return ["roomId": active.roomId, "assetVersion": active.assetVersion, "urls": urls, "totalBytes": manifest.totalBytes, "manifest": manifestObject]
    }

    func list() -> [String: Any] {
        guard let rooms = try? fileManager.contentsOfDirectory(at: roomsDirectory, includingPropertiesForKeys: [.isDirectoryKey]) else {
            return ["rooms": [], "invalidRooms": []]
        }
        var valid: [[String: Any]] = []
        var invalid: [[String: String]] = []
        for room in rooms {
            let values = try? room.resourceValues(forKeys: [.isDirectoryKey])
            guard values?.isDirectory == true else { continue }
            do { valid.append(try resolved(roomId: room.lastPathComponent)) }
            catch { invalid.append(["roomId": room.lastPathComponent, "reason": error.localizedDescription]) }
        }
        return ["rooms": valid, "invalidRooms": invalid]
    }

    func hasRoomDirectory(_ roomId: String) -> Bool {
        guard let room = try? safeIdentifier(roomId, named: "roomId") else { return false }
        var isDirectory: ObjCBool = false
        return fileManager.fileExists(atPath: roomsDirectory.appendingPathComponent(room, isDirectory: true).path, isDirectory: &isDirectory) && isDirectory.boolValue
    }

    func retainedBytes() -> Int64 {
        guard let objects = try? fileManager.contentsOfDirectory(at: objectsDirectory, includingPropertiesForKeys: [.fileSizeKey]) else { return 0 }
        return objects.reduce(0) { partial, url in
            partial + Int64((try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0)
        }
    }

    func rollback(roomId: String) throws -> [String: Any] {
        let active = try activeVersion(roomId: roomId)
        let versions = roomsDirectory.appendingPathComponent(active.roomId, isDirectory: true).appendingPathComponent("versions", isDirectory: true)
        let candidates = try fileManager.contentsOfDirectory(
            at: versions,
            includingPropertiesForKeys: [.contentModificationDateKey],
            options: [.skipsHiddenFiles]
        ).filter { $0.lastPathComponent != active.assetVersion }
            .sorted { ((try? $0.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast) > ((try? $1.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast) }
        for candidate in candidates {
            guard let manifest = try? decoder.decode(NativeAssetManifest.self, from: Data(contentsOf: candidate.appendingPathComponent("manifest.json"))) else { continue }
            guard (try? validateInstalled(manifest, versionRoot: candidate)) != nil else { continue }
            try setActive(roomId: active.roomId, assetVersion: manifest.assetVersion)
            return try resolved(roomId: active.roomId)
        }
        throw NativeAssetError.invalid("No previous compatible asset version is available")
    }

    func remove(roomId: String) throws {
        let room = try safeIdentifier(roomId, named: "roomId")
        let directory = roomsDirectory.appendingPathComponent(room, isDirectory: true)
        guard fileManager.fileExists(atPath: directory.path) else { return }
        try fileManager.removeItem(at: directory)
        try pruneUnreferencedObjects()
    }

    private func activate(stagedVersion: URL, manifest: NativeAssetManifest) throws {
        let room = try safeIdentifier(manifest.roomId, named: "roomId")
        let version = try safeIdentifier(manifest.assetVersion, named: "assetVersion")
        let roomDirectory = roomsDirectory.appendingPathComponent(room, isDirectory: true)
        let versions = roomDirectory.appendingPathComponent("versions", isDirectory: true)
        try makeDirectory(versions)
        let destination = versions.appendingPathComponent(version, isDirectory: true)
        // A deterministic assetVersion already exists only after an earlier complete
        // install. Keep it in place rather than creating a gap behind active.json.
        if fileManager.fileExists(atPath: destination.path) {
            let existing = try decoder.decode(NativeAssetManifest.self, from: Data(contentsOf: destination.appendingPathComponent("manifest.json")))
            let candidate = try decoder.decode(NativeAssetManifest.self, from: Data(contentsOf: stagedVersion.appendingPathComponent("manifest.json")))
            guard existing == candidate else { throw NativeAssetError.verification("assetVersion conflicts with an existing receipt") }
            do {
                try validateInstalled(existing, versionRoot: destination)
                try fileManager.removeItem(at: stagedVersion)
            } catch {
                // A content-addressed object can be replaced after corruption while an
                // older version still links the corrupt inode. Rebuild that version
                // from the already verified staging links, with a restorable backup.
                try validateInstalled(candidate, versionRoot: stagedVersion)
                try repairVersion(at: destination, with: stagedVersion, in: versions)
            }
        } else {
            try fileManager.moveItem(at: stagedVersion, to: destination)
        }

        try setActive(roomId: room, assetVersion: version)
    }

    private func setActive(roomId: String, assetVersion: String) throws {
        let active = ActiveAssetVersion(roomId: roomId, assetVersion: assetVersion, installedAt: Date())
        let roomDirectory = roomsDirectory.appendingPathComponent(roomId, isDirectory: true)
        let pointer = roomDirectory.appendingPathComponent("active.json")
        let pending = roomDirectory.appendingPathComponent("active.pending.json")
        try encoder.encode(active).write(to: pending, options: .atomic)
        if fileManager.fileExists(atPath: pointer.path) {
            _ = try fileManager.replaceItemAt(pointer, withItemAt: pending)
        } else {
            try fileManager.moveItem(at: pending, to: pointer)
        }
    }

    private func repairVersion(at destination: URL, with stagedVersion: URL, in versions: URL) throws {
        let backup = versions.appendingPathComponent(".repair-\(destination.lastPathComponent)-\(UUID().uuidString.lowercased())", isDirectory: true)
        try fileManager.moveItem(at: destination, to: backup)
        do {
            try fileManager.moveItem(at: stagedVersion, to: destination)
            try? fileManager.removeItem(at: backup)
        } catch {
            // Keep the old active directory recoverable if the second rename fails.
            if !fileManager.fileExists(atPath: destination.path) {
                try? fileManager.moveItem(at: backup, to: destination)
            }
            throw error
        }
    }

    private func activeVersion(roomId: String) throws -> ActiveAssetVersion {
        let room = try safeIdentifier(roomId, named: "roomId")
        let pointer = roomsDirectory.appendingPathComponent(room, isDirectory: true).appendingPathComponent("active.json")
        guard fileManager.fileExists(atPath: pointer.path) else { throw NativeAssetError.invalid("Room is not downloaded") }
        return try decoder.decode(ActiveAssetVersion.self, from: Data(contentsOf: pointer))
    }

    private func resolvedFiles(manifest: NativeAssetManifest, sharedFiles: [NativeAssetFile]) throws -> [NativeAssetFile] {
        var byPath: [String: NativeAssetFile] = [:]
        for file in sharedFiles {
            guard byPath[file.path] == nil else { throw NativeAssetError.invalid("Duplicate shared asset path: \(file.path)") }
            byPath[file.path] = file
        }
        var files = manifest.files
        for sharedPath in manifest.sharedAssets {
            guard let shared = byPath.removeValue(forKey: sharedPath) else {
                throw NativeAssetError.invalid("Manifest references missing shared asset: \(sharedPath)")
            }
            files.append(shared)
        }
        var seen = Set<String>()
        for file in files {
            _ = try safeRelativePath(file.path)
            guard file.bytes >= 0, file.sha256.range(of: "^[0-9a-fA-F]{64}$", options: .regularExpression) != nil else {
                throw NativeAssetError.invalid("Invalid size or SHA-256 for \(file.path)")
            }
            guard seen.insert(file.path).inserted else { throw NativeAssetError.invalid("Duplicate asset path: \(file.path)") }
        }
        return files
    }

    private func validate(manifest: NativeAssetManifest) throws {
        guard manifest.schemaVersion == 1, manifest.appSchemaVersion == 1 else {
            throw NativeAssetError.invalid("Unsupported asset manifest compatibility version")
        }
        _ = try safeIdentifier(manifest.roomId, named: "roomId")
        _ = try safeIdentifier(manifest.assetVersion, named: "assetVersion")
        guard manifest.totalBytes >= 0 else { throw NativeAssetError.invalid("totalBytes must be non-negative") }
        if let minimum = manifest.minAppVersion, compareVersion(currentAppVersion, minimum) == .orderedAscending {
            throw NativeAssetError.invalid("This asset package requires app version \(minimum) or newer")
        }
    }

    private func validateInstalled(_ manifest: NativeAssetManifest, versionRoot: URL) throws {
        try validate(manifest: manifest)
        let total = manifest.files.reduce(Int64(0)) { $0 + $1.bytes }
        guard total == manifest.totalBytes else { throw NativeAssetError.verification("Installed receipt has an invalid totalBytes") }
        var paths = Set<String>()
        for file in manifest.files {
            guard paths.insert(file.path).inserted else { throw NativeAssetError.verification("Installed receipt has duplicate paths") }
            try verify(file: file, at: safeFileURL(root: versionRoot.appendingPathComponent("files", isDirectory: true), relativePath: file.path))
        }
    }

    private func preflightCapacity(files: [NativeAssetFile], totalBytes: Int64) throws {
        var missingOrCorruptBytes: Int64 = 0
        for file in files {
            let object = objectsDirectory.appendingPathComponent(file.sha256.lowercased())
            if !fileManager.fileExists(atPath: object.path) || (try? verify(file: file, at: object)) == nil {
                missingOrCorruptBytes += file.bytes
            }
        }
        // A hard-linking filesystem needs less, but reserve a whole version as a
        // conservative fallback for filesystems that must copy each room file.
        let margin = max(Int64(1_048_576), totalBytes / 20)
        let required = missingOrCorruptBytes + totalBytes + margin
        guard let available = availableCapacity() else { return }
        guard available >= required else {
            throw NativeAssetError.invalid("Insufficient storage: requires \(required) bytes, available \(available) bytes")
        }
    }

    private func availableCapacity() -> Int64? {
        if let capacityProvider { return capacityProvider() }
        guard let values = try? root.resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey, .volumeAvailableCapacityKey]) else { return nil }
        if let important = values.volumeAvailableCapacityForImportantUsage { return Int64(important) }
        if let fallback = values.volumeAvailableCapacity { return Int64(fallback) }
        return nil
    }

    private func downloadURL(for file: NativeAssetFile, baseURL: URL) throws -> URL {
        let value = file.url ?? file.path
        let url: URL
        if let absolute = URL(string: value), absolute.scheme != nil {
            url = absolute
        } else {
            url = baseURL.appendingPathComponent(value)
        }
        guard isAllowedRemoteURL(url) else { throw NativeAssetError.invalid("Only approved HTTPS asset URLs are allowed") }
        return url
    }

    private func isAllowedRemoteURL(_ url: URL) -> Bool {
        if url.scheme?.lowercased() == "https" { return true }
        #if targetEnvironment(simulator)
        return url.scheme?.lowercased() == "http" && (url.host == "127.0.0.1" || url.host == "localhost")
        #else
        return false
        #endif
    }

    private var currentAppVersion: String { Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0" }
    private func compareVersion(_ lhs: String, _ rhs: String) -> ComparisonResult {
        let left = lhs.split(separator: ".").map { Int($0) ?? 0 }
        let right = rhs.split(separator: ".").map { Int($0) ?? 0 }
        for index in 0..<max(left.count, right.count) {
            let a = index < left.count ? left[index] : 0
            let b = index < right.count ? right[index] : 0
            if a != b { return a < b ? .orderedAscending : .orderedDescending }
        }
        return .orderedSame
    }

    private func stream(_ remoteURL: URL, to destination: URL, expected: NativeAssetFile, total: Int64, received: @escaping (Int64) -> Void) async throws {
        var request = URLRequest(url: remoteURL)
        request.timeoutInterval = 60
        let (bytes, response) = try await URLSession.shared.bytes(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw NativeAssetError.network("Asset server returned an unsuccessful response")
        }
        guard let finalURL = http.url, isAllowedRemoteURL(finalURL) else {
            throw NativeAssetError.network("Asset redirect ended at an unapproved URL")
        }
        if let length = http.value(forHTTPHeaderField: "Content-Length").flatMap(Int64.init), length > expected.bytes {
            throw NativeAssetError.verification("Asset response exceeds its manifest byte count")
        }
        fileManager.createFile(atPath: destination.path, contents: nil)
        let handle = try FileHandle(forWritingTo: destination)
        defer { try? handle.close() }
        var digest = SHA256()
        var count: Int64 = 0
        var chunk = Data()
        chunk.reserveCapacity(64 * 1024)
        for try await byte in bytes {
            try Task.checkCancellation()
            chunk.append(byte)
            if chunk.count == 64 * 1024 {
                guard count + Int64(chunk.count) <= expected.bytes else { throw NativeAssetError.verification("Asset response exceeds its manifest byte count") }
                try handle.write(contentsOf: chunk)
                digest.update(data: chunk)
                count += Int64(chunk.count)
                received(Int64(chunk.count))
                chunk.removeAll(keepingCapacity: true)
            }
        }
        if !chunk.isEmpty {
            guard count + Int64(chunk.count) <= expected.bytes else { throw NativeAssetError.verification("Asset response exceeds its manifest byte count") }
            try handle.write(contentsOf: chunk)
            digest.update(data: chunk)
            count += Int64(chunk.count)
            received(Int64(chunk.count))
        }
        let actualHash = digest.finalize().map { String(format: "%02x", $0) }.joined()
        guard count == expected.bytes else { throw NativeAssetError.verification("Byte count mismatch for \(expected.path)") }
        guard actualHash.caseInsensitiveCompare(expected.sha256) == .orderedSame else { throw NativeAssetError.verification("SHA-256 mismatch for \(expected.path)") }
    }

    private func verify(file: NativeAssetFile, at url: URL) throws {
        let attributes = try fileManager.attributesOfItem(atPath: url.path)
        guard let size = attributes[.size] as? NSNumber, size.int64Value == file.bytes else { throw NativeAssetError.verification("Stored byte count mismatch for \(file.path)") }
        guard try sha256(of: url).caseInsensitiveCompare(file.sha256) == .orderedSame else { throw NativeAssetError.verification("Stored SHA-256 mismatch for \(file.path)") }
    }

    private func sha256(of url: URL) throws -> String {
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }
        var digest = SHA256()
        while let data = try handle.read(upToCount: 64 * 1024), !data.isEmpty { digest.update(data: data) }
        return digest.finalize().map { String(format: "%02x", $0) }.joined()
    }

    private func pruneUnreferencedObjects() throws {
        var referenced = Set<String>()
        for entry in try fileManager.contentsOfDirectory(at: roomsDirectory, includingPropertiesForKeys: nil) {
            guard let active = try? activeVersion(roomId: entry.lastPathComponent) else { continue }
            let manifestURL = roomsDirectory.appendingPathComponent(active.roomId).appendingPathComponent("versions").appendingPathComponent(active.assetVersion).appendingPathComponent("manifest.json")
            guard let manifest = try? decoder.decode(NativeAssetManifest.self, from: Data(contentsOf: manifestURL)) else { continue }
            referenced.formUnion(manifest.files.map { $0.sha256.lowercased() })
        }
        for object in try fileManager.contentsOfDirectory(at: objectsDirectory, includingPropertiesForKeys: nil) where !referenced.contains(object.lastPathComponent.lowercased()) {
            try? fileManager.removeItem(at: object)
        }
    }

    private func makeDirectory(_ url: URL) throws { try fileManager.createDirectory(at: url, withIntermediateDirectories: true) }
    private func excludeFromBackup(_ url: URL) throws { var url = url; var values = URLResourceValues(); values.isExcludedFromBackup = true; try url.setResourceValues(values) }
    private func linkOrCopy(_ source: URL, to destination: URL) throws { do { try fileManager.linkItem(at: source, to: destination) } catch { try fileManager.copyItem(at: source, to: destination) } }
    private func safeIdentifier(_ value: String, named name: String) throws -> String { guard value.range(of: "^[A-Za-z0-9._-]+$", options: .regularExpression) != nil, !value.contains("..") else { throw NativeAssetError.invalid("Invalid \(name)") }; return value }
    private func safeRelativePath(_ path: String) throws -> [String] { guard !path.hasPrefix("/"), !path.contains("\\") else { throw NativeAssetError.invalid("Asset path must be relative") }; let parts = path.split(separator: "/").map(String.init); guard !parts.isEmpty, !parts.contains("."), !parts.contains("..") else { throw NativeAssetError.invalid("Asset path traversal rejected") }; return parts }
    private func safeFileURL(root: URL, relativePath: String) throws -> URL { try safeRelativePath(relativePath).reduce(root) { $0.appendingPathComponent($1, isDirectory: false) } }
}

@objc(NativeAssetsPlugin)
public final class NativeAssetsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeAssetsPlugin"
    public let jsName = "NativeAssets"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "download", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "rollback", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "list", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resolve", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "remove", returnType: CAPPluginReturnPromise)
    ]

    private var store: NativeAssetStore?
    private var downloads: [String: (token: UUID, task: Task<Void, Never>)] = [:]
    private var observers: [NSObjectProtocol] = []

    public override func load() {
        do { store = try NativeAssetStore() }
        catch { NSLog("Native asset storage unavailable: \(error.localizedDescription)") }
        // P8.3 does not promise background downloads. A foreground retry starts from
        // a clean staging transaction; an active version remains playable.
        observers.append(NotificationCenter.default.addObserver(
            forName: UIApplication.didEnterBackgroundNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.downloads.values.forEach { $0.task.cancel() }
        })
    }

    deinit { observers.forEach(NotificationCenter.default.removeObserver) }

    @objc func download(_ call: CAPPluginCall) {
        guard let store, let baseURLString = call.getString("baseUrl"), let baseURL = URL(string: baseURLString) else { call.reject("Native storage or baseUrl is unavailable"); return }
        do {
            let manifest = try decode(NativeAssetManifest.self, object: call.getObject("manifest"), name: "manifest")
            let shared = try decode([NativeAssetFile].self, object: call.getArray("sharedFiles"), name: "sharedFiles", defaultValue: [])
            let key = manifest.roomId
            downloads[key]?.task.cancel()
            let token = UUID()
            let task = Task { [weak self] in
                do {
                    let result = try await store.install(manifest: manifest, sharedFiles: shared, baseURL: baseURL) { phase, bytes, total, path in
                        DispatchQueue.main.async { self?.notifyListeners("progress", data: ["roomId": manifest.roomId, "phase": phase, "bytesDownloaded": bytes, "totalBytes": total, "filePath": path as Any]) }
                    }
                    DispatchQueue.main.async { self?.finishDownload(roomId: key, token: token); call.resolve(result) }
                } catch is CancellationError {
                    DispatchQueue.main.async { self?.finishDownload(roomId: key, token: token); call.reject("Download cancelled", "CANCELLED") }
                } catch {
                    DispatchQueue.main.async { self?.finishDownload(roomId: key, token: token); call.reject(error.localizedDescription, "DOWNLOAD_FAILED") }
                }
            }
            downloads[key] = (token, task)
        } catch { call.reject(error.localizedDescription, "INVALID_MANIFEST") }
    }

    @objc func cancel(_ call: CAPPluginCall) { guard let roomId = call.getString("roomId") else { call.reject("roomId is required"); return }; downloads[roomId]?.task.cancel(); call.resolve() }
    @objc func status(_ call: CAPPluginCall) {
        guard let roomId = call.getString("roomId") else { call.reject("roomId is required"); return }
        let retainedBytes = store?.retainedBytes() ?? 0
        if downloads[roomId] != nil { call.resolve(["roomId": roomId, "state": "downloading", "retainedBytes": retainedBytes]); return }
        if let installed = try? store?.resolved(roomId: roomId) { call.resolve(installed.merging(["state": "ready", "retainedBytes": retainedBytes]) { _, latest in latest }); return }
        if let store, store.hasRoomDirectory(roomId) {
            let reason: String
            do { _ = try store.resolved(roomId: roomId); reason = "Unknown installed receipt error" }
            catch { reason = error.localizedDescription }
            call.resolve(["roomId": roomId, "state": "invalid", "reason": reason, "retainedBytes": retainedBytes])
        } else { call.resolve(["roomId": roomId, "state": "notDownloaded", "retainedBytes": retainedBytes]) }
    }
    @objc func list(_ call: CAPPluginCall) { var result = store?.list() ?? ["rooms": [], "invalidRooms": []]; result["retainedBytes"] = store?.retainedBytes() ?? 0; call.resolve(result) }
    @objc func resolve(_ call: CAPPluginCall) { do { guard let roomId = call.getString("roomId") else { throw NativeAssetError.invalid("roomId is required") }; call.resolve(try store?.resolved(roomId: roomId) ?? [:]) } catch { call.reject(error.localizedDescription) } }
    @objc func remove(_ call: CAPPluginCall) { do { guard downloads.isEmpty else { throw NativeAssetError.invalid("Wait for active downloads to finish before removing assets") }; guard let roomId = call.getString("roomId") else { throw NativeAssetError.invalid("roomId is required") }; try store?.remove(roomId: roomId); call.resolve() } catch { call.reject(error.localizedDescription) } }
    @objc func rollback(_ call: CAPPluginCall) { do { guard downloads.isEmpty else { throw NativeAssetError.invalid("Wait for active downloads to finish before rolling back assets") }; guard let roomId = call.getString("roomId") else { throw NativeAssetError.invalid("roomId is required") }; call.resolve(try store?.rollback(roomId: roomId) ?? [:]) } catch { call.reject(error.localizedDescription) } }

    private func finishDownload(roomId: String, token: UUID) {
        guard downloads[roomId]?.token == token else { return }
        downloads.removeValue(forKey: roomId)
    }

    private func decode<T: Decodable>(_ type: T.Type, object: Any?, name: String, defaultValue: T? = nil) throws -> T {
        guard let object else { if let defaultValue { return defaultValue }; throw NativeAssetError.invalid("\(name) is required") }
        guard JSONSerialization.isValidJSONObject(object) else { throw NativeAssetError.invalid("\(name) must be JSON") }
        return try JSONDecoder().decode(T.self, from: JSONSerialization.data(withJSONObject: object))
    }
}

final class QuietPlacesBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(NativeAssetsPlugin())
    }
}
