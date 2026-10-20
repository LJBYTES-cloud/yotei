[CmdletBinding()]
param(
    [ValidatePattern('^\d{4}-\d{2}-\d{2}$')]
    [string]$SnapshotDate = (Get-Date -Format 'yyyy-MM-dd')
)

$ErrorActionPreference = 'Stop'
$projectRootPath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$outputRootPath = Join-Path $projectRootPath 'handoff'
$null = New-Item -ItemType Directory -Path $outputRootPath -Force

function Invoke-ProjectGit {
    param([string[]]$GitArguments)
    # Git writes successful bundle verification messages to stderr as well.
    $ErrorActionPreference = 'Continue'
    $commandOutput = @(& git -C $projectRootPath @GitArguments 2>&1)
    if ($LASTEXITCODE -ne 0) {
        throw "git $($GitArguments -join ' ') failed: $($commandOutput -join [Environment]::NewLine)"
    }
    return @($commandOutput | ForEach-Object { $_.ToString() })
}

function Add-ArchiveText {
    param(
        [IO.Compression.ZipArchive]$Archive,
        [string]$EntryName,
        [string]$Contents
    )
    $entry = $Archive.CreateEntry($EntryName)
    $writer = [IO.StreamWriter]::new($entry.Open(), [Text.UTF8Encoding]::new($false))
    try { $writer.Write($Contents) }
    finally { $writer.Dispose() }
}

# Preserve earlier handoffs instead of replacing an existing backup.
$baseName = "yotei-handoff-$SnapshotDate"
$suffix = 1
while ((Test-Path -LiteralPath (Join-Path $outputRootPath "$baseName.zip")) -or
       (Test-Path -LiteralPath (Join-Path $outputRootPath "$baseName.bundle"))) {
    $suffix += 1
    $baseName = "yotei-handoff-$SnapshotDate-$suffix"
}
$archivePath = Join-Path $outputRootPath "$baseName.zip"
$bundlePath = Join-Path $outputRootPath "$baseName.bundle"
$headCommit = (Invoke-ProjectGit -GitArguments @('rev-parse', 'HEAD')) -join ''
$initialStatus = @(Invoke-ProjectGit -GitArguments @('status', '--short'))

$null = Invoke-ProjectGit -GitArguments @('bundle', 'create', $bundlePath, '--all')
$null = Invoke-ProjectGit -GitArguments @('bundle', 'verify', $bundlePath)

$sourceFiles = @(Invoke-ProjectGit -GitArguments @('-c', 'core.quotepath=false', 'ls-files', '--cached', '--others', '--exclude-standard') |
    Where-Object {
        $fileName = [IO.Path]::GetFileName($_)
        $_ -notmatch '^(handoff|node_modules|\.expo|\.git|dist|web-build)/' -and
        $fileName -notlike '.env*' -and $fileName -ne '.npmrc' -and
        (Test-Path -LiteralPath (Join-Path $projectRootPath $_) -PathType Leaf)
    } | Sort-Object -Unique)

if ($sourceFiles.Count -eq 0) { throw 'No project source files were found.' }

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::Open($archivePath, [IO.Compression.ZipArchiveMode]::Create)
$manifestRows = [Collections.Generic.List[string]]::new()
try {
    foreach ($relativePath in $sourceFiles) {
        $sourcePath = [IO.Path]::GetFullPath((Join-Path $projectRootPath $relativePath))
        $expectedPrefix = $projectRootPath.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
        if (-not $sourcePath.StartsWith($expectedPrefix, [StringComparison]::OrdinalIgnoreCase)) {
            throw "Source path leaves the workspace: $relativePath"
        }
        $entryName = 'source/' + $relativePath.Replace('\', '/')
        $null = [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $sourcePath, $entryName, [IO.Compression.CompressionLevel]::Optimal)
        $hash = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash.ToLowerInvariant()
        $manifestRows.Add("$hash  $entryName")
    }

    $historyEntry = "history/$baseName.bundle"
    $null = [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $bundlePath, $historyEntry, [IO.Compression.CompressionLevel]::Optimal)
    $bundleHash = (Get-FileHash -LiteralPath $bundlePath -Algorithm SHA256).Hash.ToLowerInvariant()
    $manifestRows.Add("$bundleHash  $historyEntry")

    $metadata = [ordered]@{
        schema_version = 1
        snapshot_date = $SnapshotDate
        head_commit = $headCommit
        git_status_at_packaging = $initialStatus
        source_file_count = $sourceFiles.Count
        source_directory = 'source/'
        history_bundle = $historyEntry
        bundle_verified = $true
        note = 'Source includes current uncommitted/untracked project files. Git bundle contains committed history and refs only. Dependencies, environment files, device data, and generated caches/builds are not included.'
    }
    Add-ArchiveText -Archive $archive -EntryName 'SNAPSHOT.json' -Contents ($metadata | ConvertTo-Json -Depth 5)
    Add-ArchiveText -Archive $archive -EntryName 'MANIFEST.sha256' -Contents (($manifestRows -join "`n") + "`n")
    $archiveReadme = @"
# Yotei handoff - $SnapshotDate

Start with source/README.md, source/docs/PROJECT_CONTEXT.md, and
source/docs/NEXT_SESSION_PROMPT.md.

Contents:
- source/: current application source, assets, docs, tests and lockfile.
- history/$baseName.bundle: all available committed Git history and refs.
- SNAPSHOT.json: baseline commit, packaging status, and file count.
- MANIFEST.sha256: hashes of each source file and the history bundle.

To run the current source, extract source/ into a fresh directory, then run:
  npm ci
  npx expo start --clear

On Windows PowerShell, npm.cmd / npx.cmd avoid blocked .ps1 shims.

To restore committed Git history:
  git clone history/$baseName.bundle restored-yotei

The clone restores committed files. Copy the source/ contents over the clone
if you also want this snapshot's uncommitted documentation and local files.

The root source/app/index.tsx Hello World experiment was preserved.
The implemented app's active routes are source/src/app/; see the context notes.
This package does not back up device SQLite/SecureStore data or node_modules.
"@
    Add-ArchiveText -Archive $archive -EntryName 'ARCHIVE_README.md' -Contents $archiveReadme
}
finally { $archive.Dispose() }

$archiveHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
$checksumPath = "$archivePath.sha256"
[IO.File]::WriteAllText($checksumPath, "$archiveHash  $baseName.zip`n", [Text.UTF8Encoding]::new($false))

[pscustomobject]@{
    archive = $archivePath
    history_bundle = $bundlePath
    checksum = $checksumPath
    source_files = $sourceFiles.Count
    archive_bytes = (Get-Item -LiteralPath $archivePath).Length
    head_commit = $headCommit
    bundle_verified = $true
} | ConvertTo-Json
