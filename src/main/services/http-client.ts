/*
 * Copyright 2023 gematik GmbH
 *
 * The Authenticator App is licensed under the European Union Public Licence (EUPL); every use of the Authenticator App
 * Sourcecode must be in compliance with the EUPL.
 *
 * You will find more details about the EUPL here: https://joinup.ec.europa.eu/collection/eupl
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the EUPL is distributed on an "AS
 * IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the EUPL for the specific
 * language governing permissions and limitations under the License.ee the Licence for the specific language governing
 * permissions and limitations under the Licence.
 */

import got from 'got';
import { createProxyAgent } from '@/main/services/proxyResolver';
import { logger } from '@/main/services/logging';
import { IncomingHttpHeaders } from 'http';
import { stringify } from 'flatted';
import { IS_TEST } from '@/constants';
import { HttpProxyAgent, HttpsProxyAgent } from 'hpagent';

const { CookieJar } = require('tough-cookie');
const cookieJar = new CookieJar();

let gotAdvanced = got;
/* @if MOCK_MODE == 'ENABLED' */
if (!IS_TEST) {
  gotAdvanced = got.extend({
    hooks: {
      afterResponse: [
        (response) => {
          logger.debug(`afterResponse to ${response.url}`);
          // No changes otherwise
          return response;
        },
      ],
      beforeRequest: [
        (options) => {
          logger.debug(`beforeRequest ${options.method} to ${options.url}`);
        },
      ],
      beforeError: [
        (error) => {
          const { response } = error;
          logger.debug(`beforeError data:\n${stringify(response?.body)}`);
          return error;
        },
      ],
    },
  });
}

/* @endif */

export enum HTTP_METHODS {
  POST,
  GET,
}

export type TClientRes = {
  data: any;
  status: number;
  headers?: IncomingHttpHeaders;
};

export const httpClient = async (
  method: HTTP_METHODS,
  url: string,
  config: any = {},
  envelope?: any,
): Promise<TClientRes | undefined> => {
  try {
    if (method === HTTP_METHODS.POST) {
      if (typeof envelope === 'object') {
        config.json = envelope;
      } else {
        config.body = envelope;
      }
    }
    const proxy = await createProxyAgent(url);
    //we don't get debug messages from the ipcRenderer in createProxyAgent, so we log it here
    logger.debug('Proxy for Url:' + url + ' is:', proxy);
    const client = method === HTTP_METHODS.POST ? gotAdvanced.post : gotAdvanced.get;
    const res = client(url, {
      followRedirect: false, // default false, can be superseded by config.followRedirect
      ...config,
      cookieJar,
      agent: {
        https: proxy instanceof HttpsProxyAgent ? proxy : undefined,
        http: proxy instanceof HttpProxyAgent ? proxy : undefined,
      },
    });

    let data;
    try {
      data = await res.json();
    } catch (e) {
      data = await res.text();
    }

    const response = await res;

    return {
      data,
      status: response.statusCode,
      headers: response.headers,
    };
  } catch (err) {
    logger.error('http error for url: ' + url, err);

    /**
     * Electron doesn't allow us to carry information in an Error instance to renderer process.
     * That's why we throw an object instead of new Error()
     */
    throw {
      message: err.message,
      response: {
        url: err.response?.url,
        body: err.response?.body,
        headers: err.response?.headers,
        statusCode: err.response?.statusCode,
      },
    };
  }
};
