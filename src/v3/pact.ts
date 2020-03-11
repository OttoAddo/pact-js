import logger from "../common/logger"
const PactNative = require("../../src/v3/native")

export interface PactV3Options {
  dir: string
  consumer: string
  provider: string
}

export interface V3ProviderState {
  description: string
  parameters?: any
}

export class PactV3 {
  private opts: any
  private states: V3ProviderState[] = []
  private pact: any

  constructor(opts: PactV3Options & {}) {
    this.opts = opts
    this.pact = new PactNative.Pact(opts.consumer, opts.provider)
  }

  public given(providerState: any, parameters?: any) {
    this.states.push({ description: providerState, parameters })
    return this
  }

  public uponReceiving(desc: string) {
    this.pact.addInteraction(desc, this.states)
    return this
  }

  public withRequest(req: any) {
    this.pact.addRequest(req, req.body && JSON.stringify(req.body))
    return this
  }

  public willRespondWith(res: any) {
    this.pact.addResponse(res, res.body && JSON.stringify(res.body))
    this.states = []
    return this
  }

  public executeTest(testFn: any) {
    const result = this.pact.executeTest(testFn)
    if (result.testResult) {
      return result.testResult
        .then((val: any) => {
          const testResult = this.pact.getTestResult(result.mockServer.id)
          if (testResult.mockServerError) {
            return Promise.reject(
              new Error(
                "Mock server failed with an error: " +
                  testResult.mockServerResult
              )
            )
          } else if (testResult.mockServerMismatches) {
            let error = "Mock server failed with the following mismatches: "
            for (const mismatch of testResult.mockServerMismatches) {
              error += "\n\t" + mismatch
            }
            return Promise.reject(
              new Error(
                "Mock server failed with the following mismatches: " + error
              )
            )
          } else {
            this.pact.writePactFile(result.mockServer.id, this.opts.dir)
            return val
          }
        })
        .catch((err: any) => {
          const testResult = this.pact.getTestResult(result.mockServer.id)
          let error = "Test failed for the following reasons:"
          error += "\n\tTest code failed with an error: " + err.message
          if (testResult.mockServerError) {
            error +=
              "\n\tMock server failed with an error: " +
              testResult.mockServerResult
          }
          if (testResult.mockServerMismatches) {
            error += "\n\tMock server failed with the following mismatches: "
            for (const mismatch of testResult.mockServerMismatches) {
              error += "\n\t\t" + mismatch
            }
          }
          return Promise.reject(new Error(error))
        })
        .finally(() => {
          this.pact.shutdownTest(result)
        })
    } else {
      this.pact.shutdownTest(result)
      return Promise.reject(result.testError)
    }
  }
}
