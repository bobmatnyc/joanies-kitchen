/**
 * #138: the one place the brand is appended to page titles. The root layout uses
 * SITE_TITLE_TEMPLATE as `metadata.title.template`, so a page's own `title` must not
 * carry the brand, or it shows twice.
 */
export const SITE_NAME = "Joanie's Kitchen";

export const SITE_TITLE_TEMPLATE = `%s | ${SITE_NAME}`;
