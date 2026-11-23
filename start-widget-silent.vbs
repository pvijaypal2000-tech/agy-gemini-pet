Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
electronExe = scriptDir & "\node_modules\electron\dist\electron.exe"
WshShell.CurrentDirectory = scriptDir
WshShell.Run """" & electronExe & """ .", 0, False
