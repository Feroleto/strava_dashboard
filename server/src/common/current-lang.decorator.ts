import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { resolveLang, type Lang } from './lang';

export const CurrentLang = createParamDecorator((_: unknown, ctx: ExecutionContext): Lang => {
  const req = ctx.switchToHttp().getRequest();
  return resolveLang(req.headers['accept-language']);
});
