/**
 * Barrel for the CSS shorthand parsers/formatters. Split per shorthand
 * (4.3) into `parsers/{common,border,padding,borderRadius,transition,
 * animation,boxShadow,filter,color,size}.ts`; this re-export keeps
 * every `@lib/parsers` import working unchanged.
 */
export * from './parsers/index';
