@echo off
title SACD Extract Studio
cd /d "%~dp0"

if exist "C:\Users\angel\AppData\Local\Programs\Python\Python312\python.exe" (
    start "" "C:\Users\angel\AppData\Local\Programs\Python\Python312\python.exe" run_gui.py
) else (
    start "" python run_gui.py
)
exit
