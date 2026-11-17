CREATE TYPE "Sexo" AS ENUM ('FEMININO', 'MASCULINO');
CREATE TYPE "Naipe" AS ENUM ('FEMININO', 'MASCULINO', 'MISTO');

ALTER TABLE "Atleta" ADD COLUMN "sexo" "Sexo" NOT NULL DEFAULT 'MASCULINO';
ALTER TABLE "Torneio" ADD COLUMN "naipe" "Naipe" NOT NULL DEFAULT 'MISTO';

ALTER TABLE "Usuario" ALTER COLUMN "email" DROP NOT NULL;

UPDATE "Atleta" AS a
SET "sexo" = 'FEMININO'
FROM "Usuario" AS u
WHERE a."usuarioId" = u.id
  AND lower(u.email) IN (
    'ana@arena.local',
    'bia@arena.local',
    'eva@arena.local',
    'gabi@arena.local',
    'lia.torres@arena.local',
    'rita.souza@arena.local'
  );
