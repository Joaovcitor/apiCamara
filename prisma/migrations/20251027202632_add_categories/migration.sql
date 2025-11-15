-- CreateTable
CREATE TABLE "categorias" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "descricao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categoria_keywords" (
    "id" TEXT NOT NULL,
    "termo" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,

    CONSTRAINT "categoria_keywords_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categorias_slug_key" ON "categorias"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "categoria_keywords_categoriaId_termo_key" ON "categoria_keywords"("categoriaId", "termo");

-- AddForeignKey
ALTER TABLE "categoria_keywords" ADD CONSTRAINT "categoria_keywords_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
