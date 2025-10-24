interface ChefDisclaimerProps {
  /**
   * Optional chef name for singularized disclaimer.
   * If not provided, shows pluralized disclaimer for multiple chefs.
   */
  chefName?: string;
}

export function ChefDisclaimer({ chefName }: ChefDisclaimerProps) {
  const disclaimerText = chefName
    ? `This page is an educational tribute to ${chefName}'s contributions to culinary arts, compiled from publicly available sources. ${chefName} has not endorsed or approved this content, and this page is not affiliated with, sponsored by, or representing ${chefName} or their representatives.`
    : "These pages are educational tributes to these chefs' contributions to culinary arts, compiled from publicly available sources. These chefs have not endorsed or approved this content, and these pages are not affiliated with, sponsored by, or representing these chefs or their representatives.";

  return (
    <div className="border-t border-jk-olive/10 pt-6 mt-8">
      <p className="text-xs text-muted-foreground text-center max-w-3xl mx-auto leading-relaxed">
        {disclaimerText}
      </p>
    </div>
  );
}
