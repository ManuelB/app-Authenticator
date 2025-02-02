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

import { connectorReachabilityTest } from '@/renderer/modules/settings/services/test-cases/connector-reachability';
import { connectorSmcbReadabilityTest } from '@/renderer/modules/settings/services/test-cases/connector-smcb-readability';
import { idpReachabilityTest } from '@/renderer/modules/settings/services/test-cases/idp-reachability';
import { logger } from '@/renderer/service/logger';
import { certsValidityTest } from '@/renderer/modules/settings/services/test-cases/certs-validity-test';
import { SweetAlertResult } from 'sweetalert2';
import i18n from '@/renderer/i18n';

/* @if MOCK_MODE == 'ENABLED' */
import { getConfig } from '@/renderer/utils/get-configs';
import { MOCK_CONNECTOR_CONFIG } from '@/renderer/modules/connector/connector-mock/mock-config';
/* @endif */

const allTestCases: TestFunction[] = [
  connectorReachabilityTest,
  connectorSmcbReadabilityTest,
  idpReachabilityTest,
  certsValidityTest,
];

export enum TestStatus {
  success = 'success',
  failure = 'failure',
}

export type TestResult = { name: string; status: TestStatus; details: string };
type TestFunction = () => Promise<TestResult> | Promise<TestResult[]>;

export async function runTestsCases(
  testCases: TestFunction[] = allTestCases,
  cancelPromise?: Promise<SweetAlertResult<Awaited<unknown>>>,
): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const translate = i18n.global.t;
  logger.info('start test cases');

  for (const testCase of testCases) {
    /* @if MOCK_MODE == 'ENABLED' */
    const isMockModeActive = getConfig(MOCK_CONNECTOR_CONFIG).value;
    if (isMockModeActive && (testCase === connectorReachabilityTest || testCase === connectorSmcbReadabilityTest)) {
      continue;
    }
    /* @endif */

    try {
      /**
       * This promise actually only waits for the test and returns the test result,
       * but if the user clicks the cancel button, the promise rejects and stops the whole process
       */
      const restResults: TestResult | TestResult[] = await new Promise((resolve, reject): void => {
        testCase().then((testCaseResult) => {
          resolve(testCaseResult);
        });

        cancelPromise?.then((swalRes) => {
          if (!swalRes.isConfirmed) {
            reject();
          }
        });
      });

      if (Array.isArray(restResults)) {
        results.push(...restResults);
      } else {
        results.push(restResults);
      }
    } catch (e) {
      logger.info('Function test process interrupted');
      results.push({
        name: translate('function_test_cancelled'),
        details: translate('function_test_cancelled_by_user_description'),
        status: TestStatus.failure,
      });
      break;
    }
  }
  logger.info('finished test cases');
  return results;
}
