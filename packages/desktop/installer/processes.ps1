param(
  [string] $InstallDirectory,
  [string] $PreviousUserDirectory,
  [string] $PreviousMachineDirectory,
  [string] $AppExecutable,
  [int] $InstallerProcessId,
  [ValidateSet('check', 'close')] [string] $Mode = 'check'
)

$ErrorActionPreference = 'Stop'

function Select-PitchcrewProcesses($Processes, [string[]] $Directories, [string] $Executable, [int] $InstallerId) {
  foreach ($entry in $Processes) {
    if (!$entry.ExecutablePath -or $entry.ProcessId -eq $InstallerId) { continue }
    foreach ($directory in $Directories) {
      if (!$directory) { continue }
      $root = [IO.Path]::GetFullPath($directory).TrimEnd('\') + '\'
      $path = $entry.ExecutablePath
      # Match only shipped executables. A download, uninstaller or sibling directory is not the app.
      $app = $path.Equals($root + $Executable, [StringComparison]::OrdinalIgnoreCase)
      $node = $path.Equals($root + 'resources\runtime\node\node.exe', [StringComparison]::OrdinalIgnoreCase)
      $browser = $path.StartsWith($root + 'resources\runtime\browsers\', [StringComparison]::OrdinalIgnoreCase) -and
        [IO.Path]::GetFileName($path) -in @('chrome.exe', 'chrome-headless-shell.exe', 'headless_shell.exe', 'chrome_crashpad_handler.exe', 'crashpad_handler.exe', 'ffmpeg-win64.exe')
      if ($app -or $node -or $browser) { $entry; break }
    }
  }
}

# Dot sourcing exposes the same selector to regression tests without querying or stopping processes.
if ($MyInvocation.InvocationName -eq '.') { return }

try {
  if (!$InstallDirectory -or !$AppExecutable -or [IO.Path]::GetFileName($AppExecutable) -ne $AppExecutable) {
    throw 'Invalid installation path or executable.'
  }
  $directories = @($InstallDirectory, $PreviousUserDirectory, $PreviousMachineDirectory)
  function Find-PitchcrewProcesses {
    Select-PitchcrewProcesses (Get-CimInstance Win32_Process) $directories $AppExecutable $InstallerProcessId
  }
  $running = @(Find-PitchcrewProcesses)
  if ($Mode -eq 'check') {
    if ($running.Count) { exit 10 }
    exit 0
  }

  # Give Electron time to shut down its owned daemon before stopping any remaining bundled processes.
  foreach ($entry in $running) {
    $process = Get-Process -Id $entry.ProcessId -ErrorAction SilentlyContinue
    if ($process) { [void] $process.CloseMainWindow() }
  }
  for ($attempt = 0; $attempt -lt 12; $attempt++) {
    if (!(Find-PitchcrewProcesses)) { exit 0 }
    Start-Sleep -Milliseconds 250
  }
  foreach ($entry in @(Find-PitchcrewProcesses)) {
    # Recheck the executable path immediately before stopping a PID that might have been reused.
    $current = Get-CimInstance Win32_Process -Filter "ProcessId = $($entry.ProcessId)"
    if (Select-PitchcrewProcesses @($current) $directories $AppExecutable $InstallerProcessId) {
      Stop-Process -Id $entry.ProcessId -Force -ErrorAction SilentlyContinue
    }
  }
  for ($attempt = 0; $attempt -lt 12; $attempt++) {
    if (!(Find-PitchcrewProcesses)) { exit 0 }
    Start-Sleep -Milliseconds 250
  }
  exit 10
} catch {
  Write-Error $_ -ErrorAction Continue
  exit 20
}
