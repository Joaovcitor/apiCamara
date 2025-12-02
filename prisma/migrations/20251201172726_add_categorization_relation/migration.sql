-- CreateTable
CREATE TABLE "_CategoriaToLei" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_CategoriaToLei_AB_unique" ON "_CategoriaToLei"("A", "B");

-- CreateIndex
CREATE INDEX "_CategoriaToLei_B_index" ON "_CategoriaToLei"("B");

-- AddForeignKey
ALTER TABLE "_CategoriaToLei" ADD CONSTRAINT "_CategoriaToLei_A_fkey" FOREIGN KEY ("A") REFERENCES "categorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CategoriaToLei" ADD CONSTRAINT "_CategoriaToLei_B_fkey" FOREIGN KEY ("B") REFERENCES "leis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
