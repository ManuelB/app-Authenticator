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

/**
 * @jest-environment jsdom
 */

import { ERROR_CODE_EXPLANATIONS, ERROR_CODES } from '@/error-codes';

describe('test codes', () => {
  it('checks error explanation codes are well written', function () {
    for (const errorCode in ERROR_CODES) {
      // Tests fail here? Go to @/renderer/errors/error-codes file and add meaningful explanation
      // for your error code under ERROR_CODE_EXPLANATIONS object
      expect(ERROR_CODE_EXPLANATIONS[errorCode]).toBeTruthy();
    }
  });
});
