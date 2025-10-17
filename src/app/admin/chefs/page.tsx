import { ChefHat } from 'lucide-react';
import { redirect } from 'next/navigation';
import { getAllChefs } from '@/app/actions/chefs';
import { AdminChefForm } from '@/components/admin/AdminChefForm';
import { AdminScrapingPanel } from '@/components/admin/AdminScrapingPanel';
import { ChefGrid } from '@/components/chef/ChefGrid';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isAdmin } from '@/lib/admin';
import { auth } from '@/lib/auth';

export const metadata = {
  title: 'Manage Chefs | Admin',
  description: 'Manage chefs and scrape recipes',
};

export default async function AdminChefsPage() {
  const { userId } = await auth();

  if (!userId || !isAdmin(userId)) {
    redirect('/');
  }

  const chefsResult = await getAllChefs();
  const chefs = chefsResult.success ? chefsResult.chefs : [];

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-8">
        <ChefHat className="w-8 h-8 text-jk-olive" />
        <div>
          <h1 className="text-4xl font-heading text-jk-olive">Manage Chefs</h1>
          <p className="text-jk-olive/60">Add chefs and scrape their recipes</p>
        </div>
      </div>

      <Tabs defaultValue="list" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3 mb-8">
          <TabsTrigger value="list">All Chefs</TabsTrigger>
          <TabsTrigger value="add">Add Chef</TabsTrigger>
          <TabsTrigger value="scrape">Scrape</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <div className="mb-6 p-4 bg-jk-linen rounded-lg border border-jk-olive/20">
            <p className="text-sm text-jk-olive">
              Total Chefs: <strong>{chefs.length}</strong>
              {' | '}
              Total Recipes:{' '}
              <strong>{chefs.reduce((sum, chef) => sum + (chef.recipeCount || 0), 0)}</strong>
            </p>
          </div>
          <ChefGrid
            chefs={chefs as any}
            emptyMessage="No chefs added yet"
            emptyDescription="Add your first chef using the 'Add Chef' tab"
          />
        </TabsContent>

        <TabsContent value="add">
          <AdminChefForm />
        </TabsContent>

        <TabsContent value="scrape">
          <div className="max-w-2xl">
            <AdminScrapingPanel />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
