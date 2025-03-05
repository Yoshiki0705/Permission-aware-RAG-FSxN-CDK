FROM --platform=linux/arm64 public.ecr.aws/docker/library/node:20.9.0-slim AS builder
WORKDIR /app

COPY . .
RUN npm install -g pnpm
RUN pnpm i && pnpm run build

FROM --platform=linux/amd64 public.ecr.aws/docker/library/node:20.9.0-slim AS runner
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.0-x86_64 /lambda-adapter /opt/extensions/lambda-adapter

ENV PORT=3000 NODE_ENV=production AWS_LWA_INVOKE_MODE=response_stream

WORKDIR /app
# COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/run.sh ./run.sh
RUN ln -s /tmp/cache ./.next/cache
RUN chmod +x ./run.sh

CMD exec ./run.sh