export const getInitialTheme = (storedTheme) => storedTheme === 'dark' ? 'dark' : 'light';

export const nextTheme = (theme) => theme === 'dark' ? 'light' : 'dark';
