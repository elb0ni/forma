// Estado mutable compartido entre Forma3D y SpaceTransition.
// Permite que SpaceTransition arranque con la rotación exacta del icosaedro
// que estaba visible en el login, evitando el salto visual.
export const meshState = { rotY: 0, rotX: 0 }
