// Our own art in public/art, under the page's base path (R11: the replay is hosted on a sub-path).
export const art = (name: string): string => `${import.meta.env.BASE_URL}art/${name}`;
