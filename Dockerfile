ARG NODE_VERSION=22
ARG PNPM_VERSION=10.33.0

################################################################################
# Base image shared by all stages.
FROM node:${NODE_VERSION}-alpine AS base

WORKDIR /usr/src/app

RUN --mount=type=cache,target=/root/.npm \
    npm install -g pnpm@${PNPM_VERSION}

################################################################################
# Install production dependencies only.
FROM base AS deps

RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=pnpm-lock.yaml,target=pnpm-lock.yaml \
    --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --prod --frozen-lockfile

################################################################################
# Install all dependencies and build the Next.js application.
FROM deps AS build

RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=pnpm-lock.yaml,target=pnpm-lock.yaml \
    --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

################################################################################
# Minimal runtime image.
FROM base AS final

ENV NODE_ENV=production

USER node

# Copy package.json so pnpm start works.
COPY package.json .

# Production dependencies.
COPY --from=deps /usr/src/app/node_modules ./node_modules

# Next.js build output.
COPY --from=build /usr/src/app/.next ./.next

# Runtime files required by Next.js (config, static assets).
COPY --from=build /usr/src/app/next.config.ts ./next.config.ts
COPY --from=build /usr/src/app/public ./public

EXPOSE 3000

CMD ["pnpm", "start"]
