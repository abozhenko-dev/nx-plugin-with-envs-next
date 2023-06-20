import { path as rootPath } from "app-root-path";
import * as dotenv from "dotenv";
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER } from "next/constants";
import { join } from "path";
import * as dotenvExpand from "dotenv-expand";

type OptionsType = {
  paths?: string[];
  envsRootPath?: string;
  server?: string[];
  public?: string[];
};

type NextConfigType =
  | {
      target?: "serverless";
      serverRuntimeConfig?: [];
      publicRuntimeConfig?: [];
      custom?: { envs?: OptionsType };
    }
  | ((phase: string, args: unknown) => unknown);

const nodeEnv = process.env.NODE_ENV;

const exposeKeys = (keys: string[]) => {
  if (!Array.isArray(keys)) {
    throw new TypeError("The `server` and `public` keys should be arrays of env variables to expose");
  }

  return Object.fromEntries(keys.map((key) => [key, process.env[key]]));
};

module.exports =
  (config: NextConfigType = {}) =>
  async (phase: string, args: unknown) => {
    if (!phase && !args) return config;

    if (typeof config === "function") {
      config = config(phase, args);
    }

    const options: OptionsType = {
      paths: [".env", `.env.${nodeEnv}`, `.env.${nodeEnv}.local`],
      envsRootPath: rootPath,
      server: [],
      public: [],

      ...config?.custom?.envs
    };

    delete config.custom;

    if (config?.target === "serverless" && phase === PHASE_PRODUCTION_BUILD) {
      throw new Error(
        `
          nx-plugin-with-envs-next is not compatible with serverless deployment. 'publicRuntimeConfig' and 'serverRuntimeConfig' won't be exposed;
          instead, you should utilize the 'env' key. Refer to https://github.com/vercel/next.js#build-time-configuration.
        `
      );
    }

    if (phase === PHASE_PRODUCTION_SERVER || phase === PHASE_DEVELOPMENT_SERVER) {
      for (const path of options.paths) {
        const dotenvConfig = dotenv.config({ path: join(options.envsRootPath, path) });
        dotenvExpand.expand(dotenvConfig);
      }

      return {
        ...config,

        serverRuntimeConfig: {
          ...config.serverRuntimeConfig,
          ...exposeKeys(options.server)
        },
        publicRuntimeConfig: {
          ...config.publicRuntimeConfig,
          ...exposeKeys(options.public)
        }
      };
    }

    return {
      serverRuntimeConfig: {},
      publicRuntimeConfig: {},
      ...config
    };
  };
