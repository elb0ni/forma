#!/usr/bin/env bash
# Modo pruebas de FORMA: base local en Docker (copia de la real, con correos cambiados),
# correos capturados por Mailpit y servicios en puertos propios. Nunca toca la base real.
#
#   scripts/pruebas.sh encender | apagar | estado | comparar
#
# Puertos: front 5180 · back 3100 · extractor IA 8000 · base 3307 · Mailpit 8025 (web)
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
    docker start forma-pruebas-db forma-pruebas-mail > /dev/null
    echo "· base local (3307) y Mailpit (http://localhost:8025) encendidos"
    lanzar back 3100 "$BACK" npm run start:pruebas
    lanzar ia 8000 "$IA" venv/bin/python -m uvicorn main:app --port 8000
    lanzar front 5180 "$FRONT" npm run dev:pruebas
    esperar back 3100; esperar ia 8000; esperar front 5180
    echo "Listo: http://localhost:5180 · usuarios de prueba en CLAUDE.md"
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
    echo "Comparar: nueva http://localhost:5180 · actual http://localhost:5181"
    ;;
  estado)
    for x in "front 5180" "back 3100" "ia 8000" "base 3307" "mailpit 8025"; do set -- $x; libre "$2" && echo "· $1 ($2): apagado" || echo "· $1 ($2): encendido"; done
    ;;
  *) echo "uso: $0 encender | apagar | estado | comparar"; exit 1 ;;
esac
