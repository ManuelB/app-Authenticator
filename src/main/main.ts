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

// read envs from .env file for production
require('dotenv').config({ path: path.join(__dirname, '.env'), override: false });

import { app, BrowserWindow, ipcMain, protocol } from 'electron';
import path from 'path';

import {
  CUSTOM_PROTOCOL_NAME,
  IPC_FOCUS_TO_AUTHENTICATOR,
  IPC_MINIMIZE_THE_AUTHENTICATOR,
  IPC_SET_USER_AGENT,
} from '@/constants';
import appConfigFactory from '../../app-config';
import { handleDeepLink } from '@/main/services/url-service';

import { logger } from '@/main/services/logging';
import { setupEnvReadInterval } from '@/main/services/env-vars-updater';
// import and add event listeners for electron updater
import '@/main/services/electron-updater';
import OnBeforeSendHeadersListenerDetails = Electron.OnBeforeSendHeadersListenerDetails;
import BeforeSendResponse = Electron.BeforeSendResponse;

const IS_DEV = process.env.NODE_ENV === 'development';

const IS_MOCK = process.env.MOCK_MODE === 'ENABLED';

const PLATFORM_WIN32 = 'win32';
const PLATFORM_DARWIN = 'darwin';

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow: BrowserWindow | null = null;

logger.info(`Starting ${app.getName()} application...`);
logger.info(`Program version: ${app.getVersion()}`);
logger.info(`Electron version: ${process.versions.electron}`);
logger.info(`Platform: ${process.platform}`);
if (IS_DEV || IS_MOCK) {
  logger.info(`Not running in production mode: ${process.env.NODE_ENV}, mock: ${process.env.MOCK_MODE}`);
}

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { secure: true, standard: true } }]);

// clean aged log files
const appConfig = appConfigFactory();

// call event native listeners
require('./event-listeners');

/**
 * The user agent is set by the renderer process.
 * This changes for the request. That's why we need to update it every time.
 */
let customUserAgent = '';
ipcMain.on(IPC_SET_USER_AGENT, (event, userAgent) => {
  customUserAgent = userAgent;
  event.returnValue = true;
});

async function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    title: appConfig.title,
    width: appConfig.width,
    height: appConfig.height,
    minHeight: appConfig.minHeight,
    minWidth: appConfig.minWidth,
    center: true,
    icon: appConfig.icon,
    resizable: appConfig.resizable,
    backgroundColor: '#F8F9FC',
    autoHideMenuBar: true,
    webPreferences: {
      devTools: IS_DEV || IS_MOCK,
      sandbox: false, // necessary for us after version 20 as we use NodeJS features in the preload.ts
      webSecurity: appConfig.webSecurity,
      allowRunningInsecureContent: appConfig.webSecurity,
      nodeIntegration: false, // we always keep this FALSE as it is secure
      contextIsolation: true, // we always keep this TRUE as it is secure
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // change http request headers to bypass CORS
  mainWindow.webContents.session.webRequest.onBeforeSendHeaders(
    (details: OnBeforeSendHeadersListenerDetails, callback: (beforeSendResponse: BeforeSendResponse) => void) => {
      callback({
        requestHeaders: {
          Origin: '*',
          ...details.requestHeaders,
          'User-Agent': customUserAgent,
        },
      });
    },
  );

  // change http response headers to bypass CORS
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        'Access-Control-Allow-Origin': ['*'],
        ...details.responseHeaders,
      },
    });
  });

  if (IS_DEV) {
    // Load the url of the dev server if in development mode
    await mainWindow.loadURL('http://localhost:3000/');
  } else {
    // Load the index.html when not in development
    // this file is the bundled version of the src/renderer/template.html
    await mainWindow.loadFile(path.join(__dirname, 'index.html'));
  }
  // todo fix this for macOS's production
  if (process.platform === PLATFORM_WIN32) {
    setupEnvReadInterval(mainWindow);
  }
  handleDeepLink(process.argv, mainWindow);

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
    logger.info('Application window closed. Bye bye.');
  });

  /**
   * focus to authenticator app
   * We use this functionality on an error case
   */
  ipcMain.on(IPC_FOCUS_TO_AUTHENTICATOR, () => {
    if (mainWindow) {
      // foreground the app
      if (mainWindow.isMinimized()) mainWindow.restore();

      // focus to app
      mainWindow.focus();
    }
  });
  /**
   * minimize the authenticator app
   * We use this functionality if the authenticator is finish successfully
   */
  ipcMain.on(IPC_MINIMIZE_THE_AUTHENTICATOR, () => {
    mainWindow?.minimize();
  });

  if (IS_DEV) {
    mainWindow.maximize();
    mainWindow.webContents.openDevTools();
  }

  /**
   * Prevent navigating to another websites
   */
  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });
}

// Force single application instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  logger.info('Application quit because of single instance lock');
  app.quit();
} else {
  app.on('second-instance', (_e: any, argv: any) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      handleDeepLink(argv, mainWindow);
    }
  });

  // Deeplink event listener for MacOS
  app.on('open-url', (e, argv) => {
    e.preventDefault();
    handleDeepLink([argv], mainWindow);
  });

  // register url schemas
  if (IS_DEV && process.platform === PLATFORM_WIN32) {
    logger.info('Register URL schemas for platform WIN32.');
    // Set the path of electron.exe and your app.
    // These two additional parameters are only available on Windows.
    // Setting this is required to get this working in dev mode.
    app.setAsDefaultProtocolClient(CUSTOM_PROTOCOL_NAME, process.execPath, [path.resolve(process.argv[1])]);
  } else {
    app.setAsDefaultProtocolClient(CUSTOM_PROTOCOL_NAME);
  }

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.on('ready', async () => {
    logger.info('Application is ready');
    await createWindow();
  });

  /**
   * never allows open new windows
   */
  app.on('web-contents-created', (event, contents) => {
    contents.setWindowOpenHandler(() => {
      return { action: 'deny' };
    });
  });

  // Quit when all windows are closed.
  app.on('window-all-closed', () => {
    // On macOS, it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== PLATFORM_DARWIN) {
      logger.info('Application quit because of all windows are closed');
      app.quit();
    }
  });

  app.on('activate', async () => {
    // On macOS, it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) await createWindow();
  });

  // Exit cleanly on request from parent process in development mode.
  if (IS_DEV) {
    if (process.platform === PLATFORM_WIN32) {
      process.on('message', (data) => {
        if (data === 'graceful-exit') {
          logger.info('Application quit because of graceful exit');
          app.quit();
        }
      });
    } else {
      process.on('SIGTERM', () => {
        logger.info('Application quit because of sigterm');
        app.quit();
      });
    }
  }
}
