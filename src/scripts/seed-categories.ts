import { PrismaClient } from '@prisma/client';
import { defaultCategoryDictionary } from '../utils/categorizer';
import { CategoryService } from '../services/categoryService';

const prisma = new PrismaClient();
const categoryService = new CategoryService();

async function main() {
  console.log('Starting seeding...');

  for (const [slug, keywords] of Object.entries(defaultCategoryDictionary)) {
    console.log(`Seeding category: ${slug}`);
    
    try {
      // Try to create
      const category = await categoryService.createCategory({
        nome: slug.charAt(0).toUpperCase() + slug.slice(1),
        slug,
        keywords
      });
      console.log(`Created category ${category?.nome}`);
    } catch (error: any) {
      if (error.code === 'P2002' || error.message?.includes('Unique constraint')) {
        console.log(`Category ${slug} already exists. Updating keywords...`);
        // Find by slug (we need to expose this or use prisma directly here for simplicity, 
        // but let's try to use addKeywords if we can find the ID)
        
        // Since categoryService doesn't expose findBySlug, let's use prisma directly for this fix
        const existing = await prisma.categoria.findUnique({ where: { slug } });
        if (existing) {
          await categoryService.addKeywords(existing.id, keywords);
          console.log(`Updated keywords for ${slug}`);
        }
      } else {
        console.error(`Error processing ${slug}:`, error);
      }
    }
  }

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await categoryService.disconnect();
  });
