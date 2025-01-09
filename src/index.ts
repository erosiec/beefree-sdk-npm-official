import loadScript from 'load-script'
import { pipe } from 'fp-ts/lib/function'
import * as E from 'fp-ts/lib/Either'
import {
  IBeeConfig,
  IEntityContentJson,
  IBeeLoader,
  IBeeOptions,
  ILoadConfig,
  ILoadStageMode,
  IUrlConfig,
  LoadWorkspaceOptions,
  IToken,
  BeeSaveOptions,
  ILanguage,
  IBeeConfigFileManager,
  ExecCommand,
  ExecCommands,
  IExecCommandOptions,
} from './types/bee'
import beeActions, { mockedEmptyToken } from './utils/Constants'
import { fetchToken } from './services/api'
import { eitherCanExecuteAction, eitherCheckJoinParams, eitherCheckStartParams } from './utils/utils'
import * as beeTypes from './types/bee'

//this is the global variable injected from BeePlugin.js
declare let BeePlugin: any;

const BEEJS_URL = 'https://app-rsrc.getbee.io/plugin/v2/BeePlugin.js'

const API_AUTH_URL = 'https://auth.getbee.io/apiauth'

let beeLoaderUrl: IBeeLoader = {
  beePluginUrl: '',
  authUrl: ''
}

const load = (bee) => {
  loadScript(beeLoaderUrl.beePluginUrl, err => {
    if (err) {
      throw new Error('BeePlugin.js is not reachable')
    }
    return bee()
  })
}

const {
  LOAD,
  SAVE,
  SEND,
  PREVIEW,
  SAVE_AS_TEMPLATE,
  TOGGLE_STRUCTURE,
  TOGGLE_COMMENTS,
  TOGGLE_PREVIEW,
  TOGGLE_MERGETAGS_PREVIEW,
  SHOW_COMMENT,
  RELOAD,
  LOAD_WORKSPACE,
  LOAD_STAGE_MODE,
  LOAD_CONFIG,
  LOAD_ROWS,
  UPDATE_TOKEN,
  GET_CONFIG,
  SWITCH_TEMPLATE_LANGUAGE,
  SWITCH_PREVIEW,
  EXEC_COMMAND,
} = beeActions

class Bee {
  token: IToken
  bee: any // todo delete
  instance: any

  constructor(
    token?: IToken, urlConfig: IUrlConfig = { authUrl: API_AUTH_URL, beePluginUrl: BEEJS_URL }
  ) {
    beeLoaderUrl = urlConfig
    this.bee = (call) => load(() => call())
    this.token = token || mockedEmptyToken
    this.instance = null
  }

  getToken = (
    clientId: string,
    clientSecret: string,
    urlConfig:IUrlConfig = { authUrl: API_AUTH_URL, beePluginUrl: BEEJS_URL }
  ) => {
    beeLoaderUrl = urlConfig;
    if (this.token && this.token.access_token) {
      throw new Error('Toker already declared')
    }

    return fetchToken({ authUrl: urlConfig.authUrl, clientId, clientSecret })
      .then(res => {
        this.token = res.data
        return res.data
      })
  }

  start = (
    config: IBeeConfig,
    template: IEntityContentJson | object, //user can pass an empty object in some specific cases
    bucketDir?: string,
    options?: IBeeOptions
  ) => {
    const { bee, token } = this
    return pipe(
      eitherCheckStartParams(config, token),
      E.fold(
        ({ message }) => new Promise(reject => reject(message)),
        () => new Promise(resolve => {
          bee(() => BeePlugin.create(
            token,
            { ...config, startOrigin: '[npm] @beefree.io/sdk' },
            instance => {
              this.instance = instance
              instance.start(template, options)
              resolve(instance)
            }, bucketDir
          ))
        })
      )
    )
  }

  startFileManager = (
    config: IBeeConfigFileManager,
    bucketDir?: string,
    options?: IBeeOptions
  ) => {
    const { bee, token } = this
    return pipe(
      eitherCheckStartParams(config, token),
      E.fold(
        ({ message }) => new Promise(reject => reject(message)),
        () => new Promise(resolve => {
          bee(() => BeePlugin.create(
            token,
            { ...config, startOrigin: '[npm] @mailupinc/bee-plugin' },
            instance => {
              this.instance = instance
              instance.start(options)
              resolve(instance)
            }, bucketDir
          ))
        })
      )
    )
  }

  join = (
    config: IBeeConfig,
    sessionId: string,
    bucketDir?: string,
  ) => {
    const { bee, token } = this
    return pipe(
      eitherCheckJoinParams(config, sessionId, this.token),
      E.fold(
        ({ message }) => { throw new Error(message) },
        () => new Promise(resolve => {
          bee(() => BeePlugin.create(token, config, instance => {
            this.instance = instance
            instance.join(sessionId)
            resolve(instance)
          }, bucketDir))
        })
      )
    )
  }

  executeAction = (action: string, param = {}, options = {}) => {
    const { instance } = this
    return pipe(
      eitherCanExecuteAction(instance, action),
      E.fold(
        ({ message }) => { throw new Error(message) },
        () => instance[action](param, options)
      )
    )
  }

  executeGetConfigAction = () :IBeeConfig => {
    const { instance } = this

    return instance[GET_CONFIG]()
  }



  load = (template: IEntityContentJson) => this.executeAction(LOAD, template)

  loadRows = () => this.executeAction(LOAD_ROWS)

  save = (options?: BeeSaveOptions) => this.executeAction(SAVE, options)

  saveAsTemplate = () => this.executeAction(SAVE_AS_TEMPLATE)

  send = (args?: ILanguage) => this.executeAction(SEND, args)

  preview = () => this.executeAction(PREVIEW)

  toggleStructure = () => this.executeAction(TOGGLE_STRUCTURE)

  togglePreview = () => this.executeAction(TOGGLE_PREVIEW)

  toggleComments = () => this.executeAction(TOGGLE_COMMENTS)

  toggleMergeTagsPreview = () => this.executeAction(TOGGLE_MERGETAGS_PREVIEW)

  showComment = (comment) => this.executeAction(SHOW_COMMENT, comment)

  reload = (template: IEntityContentJson, options?: IBeeOptions) => this.executeAction(RELOAD, template, options)

  loadWorkspace = (type: LoadWorkspaceOptions) => this.executeAction(LOAD_WORKSPACE, type)

  loadStageMode = (args: ILoadStageMode) => this.executeAction(LOAD_STAGE_MODE, args)

  loadConfig = (args: ILoadConfig) => this.executeAction(LOAD_CONFIG, args)

  updateToken = (updateTokenArgs: IToken) => this.executeAction(UPDATE_TOKEN, updateTokenArgs)

  getConfig = () => this.executeGetConfigAction()

  switchTemplateLanguage = (args: ILanguage) => this.executeAction(SWITCH_TEMPLATE_LANGUAGE, args)

  switchPreview = (args?: ILanguage) => this.executeAction(SWITCH_PREVIEW, args)

  execCommand = (command: ExecCommands, options?: IExecCommandOptions): ExecCommand => this.executeAction(EXEC_COMMAND, command, options)
}


export default Bee
export { beeTypes }
