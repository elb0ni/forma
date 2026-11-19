#!/usr/bin/env bash
# Programa el robot de juicios de SofiaPlus en este equipo (temporizador de systemd del usuario).
# Corre todos los días a las 6:00; si el equipo estaba apagado, corre al encender.
# El servidor de FORMA decide qué fichas tocan cada día (ver juicios/regla.ts),
# así que correrlo a diario no repite lecturas.
#
#   scripts/robot-juicios.sh instalar | estado | correr-ahora | quitar
#
# OJO: usa el .env de reporte_juicios (SofiaPlus real y la FORMA que diga FORMA_API_URL).
set -euo pipefail
ROBOT="$HOME/Desktop/Proyectos/Python/reporte_juicios"
UNIDADES="$HOME/.config/systemd/user"
NOMBRE=forma-robot-juicios

case "${1:-estado}" in
  instalar)
    [ -x "$ROBOT/venv/bin/python" ] || { echo "No encuentro $ROBOT/venv"; exit 1; }
    mkdir -p "$UNIDADES"
    cat > "$UNIDADES/$NOMBRE.service" <<UNIT
[Unit]
Description=FORMA: robot de juicios de SofiaPlus

[Service]
Type=oneshot
WorkingDirectory=$ROBOT
Environment=HEADLESS=1
ExecStart=$ROBOT/venv/bin/python main.py
UNIT
    cat > "$UNIDADES/$NOMBRE.timer" <<UNIT
[Unit]
Description=FORMA: robot de juicios todos los días a las 6:00

[Timer]
OnCalendar=*-*-* 06:00:00
Persistent=true

[Install]
WantedBy=timers.target
UNIT
    systemctl --user daemon-reload
    systemctl --user enable --now "$NOMBRE.timer"
    echo "Instalado. Próxima corrida:"; systemctl --user list-timers "$NOMBRE.timer" --no-pager
    ;;
  estado)
    systemctl --user list-timers "$NOMBRE.timer" --no-pager 2>/dev/null || echo "No está instalado."
    journalctl --user -u "$NOMBRE.service" -n 15 --no-pager 2>/dev/null || true
    ;;
  correr-ahora) systemctl --user start "$NOMBRE.service" && echo "Corriendo; ver: $0 estado" ;;
  quitar)
    systemctl --user disable --now "$NOMBRE.timer" 2>/dev/null || true
    rm -f "$UNIDADES/$NOMBRE.service" "$UNIDADES/$NOMBRE.timer"
    systemctl --user daemon-reload; echo "Quitado."
    ;;
  *) echo "uso: $0 instalar | estado | correr-ahora | quitar"; exit 1 ;;
esac
