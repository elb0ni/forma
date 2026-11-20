#!/usr/bin/env bash
# Modo pruebas de FORMA: base local en Docker (copia de la real, con correos cambiados),
# correos capturados por Mailpit y servicios en puertos propios. Nunca toca la base real.
#
#   npm run pruebas | pruebas:apagar | pruebas:estado   (o scripts/pruebas.sh encender | apagar | estado | comparar)
#
# Puertos: los de siempre (front 5173 · back 3000 · extractor IA 8000) + base 3307 · Mailpit 8025 (web).
# Por eso el modo real y el de pruebas no pueden estar encendidos a la vez.
set -euo pipefail
RAIZ="$HOME/Desktop/Proyectos"
FRONT="$RAIZ/Javascript/forma"; BACK="$RAIZ/Javascript/forma_server"; IA="$RAIZ/Python/forma_digitalizer"
RUN="$HOME/.cache/forma-pruebas"; mkdir -p "$RUN"

libre() { ! ss -ltn "( sport = :$1 )" | grep -q LISTEN; }
lanzar() {  # nombre puerto dir comando...
  local n=$1 p=$2 d=$3; shift 3
  if ! libre "$p"; then echo "· $n ya está en el puerto $p"; return; fi
  (cd "$d" && nohup "$@" > "$RUN/$n.log" 2>&1 & echo $! > "$RUN/$n.pid")
  echo "· $n encendiéndose en el puerto $p (log: $RUN/$n.log)"
}
esperar() { for _ in $(seq 1 90); do ! libre "$2" && { echo "  $1 listo"; return; }; sleep 1; done; echo "  $1 no respondió: revisa $RUN/$1.log"; }

case "${1:-estado}" in
  encender)
    for x in "back 3000" "front 5173"; do set -- $x
      if ! libre "$2"; then
        if [ -f "$RUN/$1.pid" ] && kill -0 "$(cat "$RUN/$1.pid")" 2>/dev/null; then continue; fi
        echo "✗ El puerto $2 ($1) está ocupado, seguramente por el modo real. Apágalo y vuelve a intentar."; exit 1
      fi
    done
    docker start forma-pruebas-db forma-pruebas-mail > /dev/null
    echo "· base local (3307) y Mailpit (http://localhost:8025) encendidos"
    lanzar back 3000 "$BACK" npm run start:pruebas
    lanzar ia 8000 "$IA" venv/bin/python -m uvicorn main:app --port 8000
    lanzar front 5173 "$FRONT" npm run dev:pruebas
    esperar back 3000; esperar ia 8000; esperar front 5173
    echo "Listo: http://localhost:5173 · usuarios @prueba.forma.local, contraseña Pruebas2026! · correos en http://localhost:8025"
    ;;
  apagar)
    for n in version-actual front ia back; do
      if [ -f "$RUN/$n.pid" ]; then pkill -TERM -P "$(cat "$RUN/$n.pid")" 2>/dev/null || true; kill "$(cat "$RUN/$n.pid")" 2>/dev/null || true; rm -f "$RUN/$n.pid"; echo "· $n apagado"; fi
    done
    docker stop forma-pruebas-db forma-pruebas-mail > /dev/null && echo "· base local y Mailpit apagados"
    ;;
  comparar)
    # La versión anterior (rama refactor/solo-etapa-productiva) en :5181, contra el mismo back de pruebas.
    VIEJA="$RAIZ/Javascript/forma-version-actual"
    [ -d "$VIEJA" ] || { echo "Falta la carpeta $VIEJA (git worktree add ../forma-version-actual refactor/solo-etapa-productiva)"; exit 1; }
    lanzar version-actual 5181 "$VIEJA" npx vite --mode pruebas --port 5181 --strictPort
    esperar version-actual 5181
    echo "Comparar: nueva http://localhost:5173 · actual http://localhost:5181"
    ;;
  estado)
    for x in "front 5173" "back 3000" "ia 8000" "base 3307" "mailpit 8025"; do set -- $x; libre "$2" && echo "· $1 ($2): apagado" || echo "· $1 ($2): encendido"; done
    ;;
  *) echo "uso: $0 encender | apagar | estado | comparar"; exit 1 ;;
esac
