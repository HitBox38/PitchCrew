!define PITCHCREW_INSTALLER_SOURCE "${__FILEDIR__}"

# electron-builder's default check matches arbitrary path prefixes and loads PowerShell profiles.
# Keep its running-app consent flow, using a bounded check of the actual shipped executables.
!macro pitchcrewProcessCommand MODE
  nsExec::ExecToStack /TIMEOUT=30000 `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\pitchcrew-processes.ps1" -InstallDirectory "$INSTDIR\." -PreviousUserDirectory "$R8" -PreviousMachineDirectory "$R9" -AppExecutable "${APP_EXECUTABLE_FILENAME}" -InstallerProcessId $R7 -Mode ${MODE}`
  Pop $R0
  Pop $R6
  ${If} $R0 != 0
  ${AndIf} $R0 != 10
    DetailPrint "Process check failed ($R0): $R6"
  ${EndIf}
!macroend

!macro customCheckAppRunning
  InitPluginsDir
  File /oname=$PLUGINSDIR\pitchcrew-processes.ps1 "${PITCHCREW_INSTALLER_SOURCE}\processes.ps1"
  Push $R7
  Push $R8
  Push $R9
  Push $R6
  Push $0
  System::Call 'kernel32::GetCurrentProcessId() i .r0'
  StrCpy $R7 $0
  Pop $0
  StrCpy $R8 ""
  StrCpy $R9 ""
  !ifndef BUILD_UNINSTALLER
    ReadRegStr $R8 HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation
    ReadRegStr $R9 HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation
    ${If} $R8 != ""
      StrCpy $R8 "$R8\."
    ${EndIf}
    ${If} $R9 != ""
      StrCpy $R9 "$R9\."
    ${EndIf}
  !endif
  pitchcrew_check:
    !insertmacro pitchcrewProcessCommand check
    ${If} $R0 == 0
      Goto pitchcrew_done
    ${ElseIf} $R0 != 10
      Goto pitchcrew_check_failed
    ${EndIf}
    ${IfNot} ${isUpdated}
      MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "$(appRunning)" /SD IDOK IDOK pitchcrew_close
      SetErrorLevel 2
      Quit
    ${EndIf}
  pitchcrew_close:
    DetailPrint "$(appClosing)"
    !insertmacro pitchcrewProcessCommand close
    ${If} $R0 == 0
      Goto pitchcrew_done
    ${ElseIf} $R0 != 10
      Goto pitchcrew_check_failed
    ${EndIf}
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDCANCEL IDRETRY pitchcrew_check
    SetErrorLevel 2
    Quit
  pitchcrew_check_failed:
    MessageBox MB_RETRYCANCEL|MB_ICONSTOP "Pitchcrew Setup could not check running processes. Check that Windows PowerShell is available, then click Retry." /SD IDCANCEL IDRETRY pitchcrew_check
    SetErrorLevel 2
    Quit
  pitchcrew_done:
    Pop $R6
    Pop $R9
    Pop $R8
    Pop $R7
!macroend
