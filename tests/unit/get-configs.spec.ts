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

/**
 * @jest-environment jsdom
 */
import { setSampleData } from '../utils/config-sample-data';
import { FileStorageRepository, TRepositoryData } from '../../src/renderer/modules/settings/repository';
import ConnectorConfig from '../../src/renderer/modules/connector/connector_impl/connector-config';
import { PROCESS_ENVS } from '../../src/constants';
import { logger } from '../../src/renderer/service/logger';

describe('configMapperByGroup and error handling response', () => {
  beforeEach(() => {
    // clear local storage
    const fileStorageRepository = new FileStorageRepository();
    fileStorageRepository.clear();

    setSampleData();

    // put params in connector store
    ConnectorConfig.updateConnectorParameters();
  });

  it('should set context parameters right', function () {
    expect(ConnectorConfig.contextParameters).toMatchSnapshot();
  });

  it('should set setEntryOptions right', function () {
    expect(ConnectorConfig.tlsEntryOptions).toMatchSnapshot();
  });

  it('should set auth sign params properly', function () {
    expect(ConnectorConfig.authSignParameter).toMatchSnapshot();
  });

  it('should load the config properly', function () {
    const fileStorageRepository = new FileStorageRepository();
    fileStorageRepository.clear();
    let data: TRepositoryData = fileStorageRepository.load();

    logger.info('data:' + data);
  });
});

describe('config file location test', () => {
  const env = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...env };
  });

  afterEach(() => {
    process.env = env;
  });

  // When AUTHCONFIGPATH and COMPUTERNAME but not CLIENTNAME are set, the config-file should be located in AUTHCONFIGPATH + \\ + COMPUTERNAME
  it('test FileStorageRepository-getConfigPath-COMPUTERNAME', async () => {
    process.env.NODE_ENV = 'development';
    PROCESS_ENVS.COMPUTERNAME = 'COMPUTERNAME1';
    PROCESS_ENVS.AUTHCONFIGPATH = 'PATH1';

    let path = FileStorageRepository.getConfigPath();
    expect(path).toContain(PROCESS_ENVS.AUTHCONFIGPATH);
    expect(path).toContain(PROCESS_ENVS.COMPUTERNAME);
  });

  // When AUTHCONFIGPATH and CLIENTNAME are set, the config-file should be located in AUTHCONFIGPATH + \\ + CLIENTNAME
  it('test FileStorageRepository-getConfigPath-CLIENTNAME', async () => {
    process.env.NODE_ENV = 'development';
    PROCESS_ENVS.CLIENTNAME = 'NW001';
    PROCESS_ENVS.COMPUTERNAME = 'COMPUTERNAME1';
    PROCESS_ENVS.AUTHCONFIGPATH = 'PATH1';

    let path = FileStorageRepository.getConfigPath();

    expect(path).toContain(PROCESS_ENVS.AUTHCONFIGPATH);
    expect(path).toContain(PROCESS_ENVS.CLIENTNAME);
  });
});
