/*
 * Copyright (c) 2023 gematik GmbH
 * 
 * Licensed under the EUPL, Version 1.2 or – as soon they will be approved by
 * the European Commission - subsequent versions of the EUPL (the Licence);
 * You may not use this work except in compliance with the Licence.
 * You may obtain a copy of the Licence at:
 * 
 *     https://joinup.ec.europa.eu/software/page/eupl
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the Licence is distributed on an "AS IS" basis,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the Licence for the specific language governing permissions and
 * limitations under the Licence.
 * 
 */

import { BrowserWindow } from 'electron';
import { URL } from 'url';
import {
  CUSTOM_PROTOCOL_NAME,
  IPC_CENTRAL_IDP_AUTH_START_EVENT,
  IPC_OGR_IDP_START_EVENT,
  IPC_WARN_USER,
} from '@/constants';
import { ERROR_CODES } from '@/error-codes';
import { TOidcProtocol2UrlSpec, TUserWarnObject } from '@/@types/common-types';
import { logger } from '@/main/services/logging';

type TParsedLauncherArguments = TOidcProtocol2UrlSpec | undefined;

export function parseLauncherArguments(link: string): TParsedLauncherArguments {
  try {
    const parsedLink = new URL(link);

    const authzPath = parseUrlFor('authz_path', parsedLink.search) || '';
    const challengePath = parseUrlFor('challenge_path', parsedLink.search) || '';
    return {
      authz_path: decodeURLRecursively(authzPath), // Authorization Path from Idp
      challenge_path: decodeURLRecursively(challengePath), // Challenge Path from Smart IDP or RP
    };
  } catch (err) {
    logger.error(`Cannot parse launcher arguments. Error: ${err.message}`);
  }
}

/**
 * parses and gets the needed parameter
 * @param needle
 * @param searchParams
 */
export function parseUrlFor(needle: 'authz_path' | 'challenge_path', searchParams: string): string | null {
  if (searchParams.startsWith(`?${needle}`)) {
    return searchParams.replace(`?${needle}=`, '');
  }

  return null;
}

export function decodeURLRecursively(url: string): string {
  if (url.indexOf('%') != -1) {
    return decodeURLRecursively(decodeURIComponent(url));
  }
  return url;
}

export function handleDeepLink(argv: string[], mainWindow: BrowserWindow | null) {
  const deeplink = decodeURLRecursively(argv.find((arg) => arg.startsWith(CUSTOM_PROTOCOL_NAME)) || '');
  if (!deeplink) {
    return undefined;
  }
  try {
    startAuthFlow(deeplink, mainWindow);
  } catch (e) {
    mainWindow?.maximize();
    mainWindow?.focus();
  }

  return deeplink;
}

/**
 * Starts the auth flow for Deeplink and Http version
 * @param url
 * @param mainWindow
 * @param serverMode
 */
export const startAuthFlow = (url: string, mainWindow: BrowserWindow | null, serverMode = false) => {
  try {
    const args = parseLauncherArguments(url);

    if (args) {
      // authz_path triggers the keycloak event and in any other case we start the gem cidp flow
      const eventName = args.authz_path ? IPC_OGR_IDP_START_EVENT : IPC_CENTRAL_IDP_AUTH_START_EVENT;

      if (mainWindow) {
        mainWindow.webContents.send(eventName, { ...args, serverMode });

        // foreground the app
        if (mainWindow.isMinimized()) mainWindow.restore();

        // focus to app
        mainWindow.focus();
      }
    }
  } catch (e) {
    const warnData: TUserWarnObject = {
      data: { code: ERROR_CODES.AUTHCL_0001 },
      swalOptions: {
        icon: 'error',
      },
    };
    mainWindow?.webContents.send(IPC_WARN_USER, warnData);

    logger.error('Parsing launcher parameters and starting AuthFlow has failed!. Error: ' + e);
    throw new Error('Parsing parameters and starting AuthFlow has failed!');
  }
};
