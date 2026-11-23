@echo off
chcp 65001 >nul
setlocal

echo.
echo ====================================================
echo   Gemini 蓝紫猫娘 · Antigravity 悬浮桌宠 v3.0.0 一键安装
echo ====================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 Node.js！请先前往 https://nodejs.org/ 安装 Node.js 18+ 后重试。
    pause
    exit /b 1
)

cd /d "%~dp0"
if not exist "node_modules\electron\dist\electron.exe" (
    echo 正在安装 Electron 桌面运行环境（首次需要联网下载）...
    call npm install
    if errorlevel 1 (
        echo [安装失败] npm install 执行出错，请检查网络或配置 npm/Electron 镜像后重试。
        pause
        exit /b 1
    )
)

node "%~dp0install_plugin.mjs" --skip-npm
if errorlevel 1 (
    echo [安装失败] 请带上上方报错信息在 GitHub Issues 中反馈排查。
    pause
    exit /b 1
)

echo.
pause
exit /b 0
