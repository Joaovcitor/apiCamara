-- CreateTable
CREATE TABLE "leis" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "ementa" TEXT,
    "numero" TEXT NOT NULL,
    "data" TIMESTAMP(3),
    "origem" TEXT NOT NULL,
    "textoCompleto" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capitulos" (
    "id" TEXT NOT NULL,
    "numero" TEXT,
    "nome" TEXT,
    "ordem" INTEGER NOT NULL,
    "leiId" TEXT NOT NULL,

    CONSTRAINT "capitulos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artigos" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "leiId" TEXT NOT NULL,
    "capituloId" TEXT,

    CONSTRAINT "artigos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paragrafos" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "artigoId" TEXT NOT NULL,

    CONSTRAINT "paragrafos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incisos" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "paragrafoId" TEXT,
    "artigoId" TEXT,

    CONSTRAINT "incisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alineas" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "incisoId" TEXT NOT NULL,

    CONSTRAINT "alineas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "alineaId" TEXT NOT NULL,

    CONSTRAINT "itens_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "capitulos" ADD CONSTRAINT "capitulos_leiId_fkey" FOREIGN KEY ("leiId") REFERENCES "leis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artigos" ADD CONSTRAINT "artigos_leiId_fkey" FOREIGN KEY ("leiId") REFERENCES "leis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artigos" ADD CONSTRAINT "artigos_capituloId_fkey" FOREIGN KEY ("capituloId") REFERENCES "capitulos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paragrafos" ADD CONSTRAINT "paragrafos_artigoId_fkey" FOREIGN KEY ("artigoId") REFERENCES "artigos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incisos" ADD CONSTRAINT "incisos_paragrafoId_fkey" FOREIGN KEY ("paragrafoId") REFERENCES "paragrafos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incisos" ADD CONSTRAINT "incisos_artigoId_fkey" FOREIGN KEY ("artigoId") REFERENCES "artigos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alineas" ADD CONSTRAINT "alineas_incisoId_fkey" FOREIGN KEY ("incisoId") REFERENCES "incisos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens" ADD CONSTRAINT "itens_alineaId_fkey" FOREIGN KEY ("alineaId") REFERENCES "alineas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
