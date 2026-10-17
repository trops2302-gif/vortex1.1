@echo off
REM Edite as duas pastas abaixo com o caminho dos seus jogos
set PASTA1=D:\Jogos
set PASTA2=E:\Jogos
cd /d "%~dp0"
python -m pip install -r requirements.txt
python vortex_agent.py --folders "%PASTA1%" "%PASTA2%"
pause
