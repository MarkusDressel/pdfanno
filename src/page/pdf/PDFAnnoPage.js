// import axios from 'axios'
import * as annoUI from 'anno-ui'
import { loadFiles } from './loadFiles'
import { getSearchHighlight } from '../search'
import * as socket from '../socket'
import { convertToExportY, paddingBetweenPages, nextZIndex } from '../../shared/coords'
import {
  unlistenWindowLeaveEvent,
  adjustViewerSize
} from '../util/window'
// import { saveSpan } from '../../core/src/UI/span'
import * as Utils from '../../shared/util'
import * as constants from '../../shared/constants'
import * as pako from 'pako'
import { PDFEXTRACT_VERSION } from '../../core/src/version'

/**
 * PDFAnno's Annotation functions for Page produced by .
 */
export default class PDFAnnoPage {

  constructor () {
    this.autoBind()
  }

  autoBind () {
    Object.getOwnPropertyNames(this.constructor.prototype)
      .filter(prop => typeof this[prop] === 'function')
      .forEach(method => {
        this[method] = this[method].bind(this)
      })
  }

  /**
   * Start PDFAnno Application.
   */
  startViewerApplication () {

    // window.addEventListener('DOMContentLoaded', () => {

    // Adjust the height of viewer.
    adjustViewerSize()

    // Reset the confirm dialog at leaving page.
    unlistenWindowLeaveEvent()

    Utils.dispatchWindowEvent('iframeReady')
    // })

    // window.addEventListener('pagerendered', ev => {
    //     dispatchWindowEvent('pagerendered', ev.detail)
    // })

    // window.addEventListener('annotationrendered', () => {
    //     dispatchWindowEvent('annotationrendered')
    // })

    // Set the confirm dialog when leaving a page.
    // window.addEventListener('annotationUpdated', () => {
    //     listenWindowLeaveEvent()
    //     dispatchWindowEvent('annotationUpdated')
    // })

    // enable text input.
    // window.addEventListener('enableTextInput', e => {
    //     dispatchWindowEvent('enableTextInput', e.detail)
    // })
    //
    // // disable text input.
    // window.addEventListener('disappearTextInput', e => {
    //     dispatchWindowEvent('disappearTextInput', e.detail)
    // })
    //
    // window.addEventListener('annotationDeleted', e => {
    //     dispatchWindowEvent('annotationDeleted', e.detail)
    // })
    //
    // window.addEventListener('annotationHoverIn', e => {
    //     dispatchWindowEvent('annotationHoverIn', e.detail)
    // })
    //
    // window.addEventListener('annotationHoverOut', e => {
    //     dispatchWindowEvent('annotationHoverOut', e.detail)
    // })
    //
    // window.addEventListener('annotationSelected', e => {
    //     dispatchWindowEvent('annotationSelected', e.detail)
    // })
    //
    // window.addEventListener('annotationDeselected', () => {
    //     dispatchWindowEvent('annotationDeselected')
    // })

    // setInterval(this.checkAnnotationUpdate, 1500)
  }

  /**
   * Load files(contents and annoFiles).
   *
   * @param {Array<File>} files - files user selected in a file dialog.
   * @return {Promise}
   */
  loadFiles (files) {
    return loadFiles(files).then(result => {
      this.contentFiles = result.contents.map(c => {
        return Object.assign(c, {
          selected : false
        })
      })
      this.annoFiles = result.annos.map(a => {
        return Object.assign(a, {
          primary   : false,
          reference : false
        })
      })
    })
  }

  getContentFile (name) {
    const items = this.contentFiles.filter(c => c.name === name)
    if (items.length > 0) {
      return items[0]
    }
    return null
  }

  getAnnoFile (name) {
    const items = this.annoFiles.filter(c => c.name === name)
    if (items.length > 0) {
      return items[0]
    }
    return null
  }

  displayContent (contentName) {

    let contentFile = this.contentFiles.filter(c => c.name === contentName)
    if (contentFile.length === 0) {
      console.log('displayContent: NOT FOUND FILE. file=', contentName)
      return
    }

    this.displayViewer(contentFile[0])
  }

  displayViewer (contentFile) {

    // Reset settings.
    this.resetPDFViewerSettings()

    // Load PDF.
    const uint8Array = new Uint8Array(contentFile.content)
    window.PDFViewerApplication.open(uint8Array)

    // Set the PDF file name.
    window.PDFView.url = contentFile.name

    // Save the current.
    this.currentContentFile = contentFile
  }

  setCurrentContentFile (contentFile) {
    this.currentContentFile = contentFile
  }

  getCurrentContentFile () {
    return this.currentContentFile
  }

  /**
   * Start the viewer.
   */
  initializeViewer (initialPDFPath = '../pdfs/P12-1046.pdf', viewerSelector = '#viewer') {

    window.pdf = null
    window.pdfName = null

    // Reset setting.
    this.resetPDFViewerSettings()

    // let url = './viewer.html'
    // if (initialPDFPath) {
    //     url += '?file=' + initialPDFPath
    // }

    // // Reload pdf.js.
    // $(viewerSelector + ' iframe').remove()
    // $(viewerSelector).html('<iframe src="' + url + '" class="anno-viewer" frameborder="0"></iframe>')
  }

  /**
   * Close the viewer.
   */
  closePDFViewer () {
    if (window.PDFViewerApplication) {
      window.PDFViewerApplication.close()
      $('#numPages', window.document).text('')
      this.currentContentFile = null
      Utils.dispatchWindowEvent('didCloseViewer')
    }
  }

  /**
   * Reset the setting of PDFViewer.
   */
  resetPDFViewerSettings () {
    localStorage.removeItem('database')
  }

  /**
   * Create a Span annotation.
   */
  createSpan ({ text = null, color = null } = {}) {
    // TODO Refactoring: a little too long.

    // Get user selection.
    const rects = window.PDFAnnoCore.default.UI.getRectangles()
    // console.log('createSpan:rects:', rects)

    // Get a search result, if exists.
    const highlight = getSearchHighlight()

    // Get selected annotations.
    const selectedAnnotations = window.annotationContainer.getSelectedAnnotations()

    // Check empty.
    if (!rects && !highlight && selectedAnnotations.length === 0) {
      console.log('check:', rects)
      return annoUI.ui.alertDialog.show({ message : 'Select text span or an annotation.' })
    }

    // Change color and label.
    if (selectedAnnotations.length > 0) {
      selectedAnnotations
        .filter(anno => anno.type === 'span')
        .forEach(anno => {
          anno.color = color
          anno.text = text
          anno.render()
          anno.enableViewMode()
        })
      Utils.dispatchWindowEvent('disappearTextInput')

      // Create a new rectAnnotation.
    } else if (rects) {
      window.PDFAnnoCore.default.UI.createSpan({ text, zIndex : nextZIndex(), color })

    } else if (highlight) {

      const span = window.saveSpan({
        page         : highlight.page,
        rects        : highlight.rectangles,
        text,
        zIndex       : nextZIndex(),
        color,
        textRange    : highlight.textRange,
        selectedText : highlight.selectedText
      })

      this.addAnnotation(span)

      Utils.dispatchWindowEvent('enableTextInput', {
        uuid      : span.uuid,
        text      : text,
        autoFocus : true
      })
    }

    // Notify annotation added.
    Utils.dispatchWindowEvent('annotationrendered')
  }

  /**
   * Create a Relation annotation.
   */
  createRelation ({ type, text = null, color = null } = {}) {

    // for old style.
    if (arguments.length === 1 && typeof arguments[0] === 'string') {
      type = arguments[0]
    }

    // If a user select relation annotation(s), change the color and text only.
    const relAnnos = window.annotationContainer.getSelectedAnnotations()
      .filter(anno => anno.type === 'relation')
    if (relAnnos.length > 0) {
      relAnnos
        .filter(anno => anno.direction === type)
        .forEach(anno => {
          anno.text = text
          anno.color = color
          anno.render()
          anno.enableViewMode()
        })
      return
    }

    let selectedAnnotations = window.annotationContainer.getSelectedAnnotations()
    selectedAnnotations = selectedAnnotations.filter(a => {
      return a.type === 'rect' || a.type === 'span'
    }).sort((a1, a2) => {
      return (a1.selectedTime - a2.selectedTime) // asc
    })

    if (selectedAnnotations.length < 2) {
      return annoUI.ui.alertDialog.show({ message : 'Two annotated text spans are not selected.\nTo select multiple annotated spans, click the first annotated span, then Ctrl+Click (Windows) or Cmd+Click (OSX) the second span.' })
    }

    const first  = selectedAnnotations[selectedAnnotations.length - 2]
    const second = selectedAnnotations[selectedAnnotations.length - 1]
    // console.log('first:second,', first, second)

    // Check duplicated.
    const arrows = window.annotationContainer
      .getAllAnnotations()
      .filter(a => a.type === 'relation')
      .filter(a => {
        return Utils.anyOf(a.rel1Annotation.uuid, [first.uuid, second.uuid])
          && Utils.anyOf(a.rel2Annotation.uuid, [first.uuid, second.uuid])
      })

    if (arrows.length > 0) {
      console.log('same found!!!')
      // Update!!
      arrows[0].direction = type
      arrows[0].rel1Annotation = first
      arrows[0].rel2Annotation = second
      arrows[0].text = text
      arrows[0].color = color || arrows[0].color
      arrows[0].save()
      arrows[0].render()
      arrows[0].enableViewMode()

      // Show label input.
      Utils.dispatchWindowEvent('enableTextInput', {
        uuid : arrows[0].uuid,
        text : arrows[0].text
      })
      return
    }

    window.PDFAnnoCore.default.UI.createRelation({
      type,
      anno1 : first,
      anno2 : second,
      text,
      color
    })

    // Notify annotation added.
    Utils.dispatchWindowEvent('annotationrendered')
  }

  /**
   * Display annotations an user selected.
   */
  displayAnnotation (isPrimary) {

    // Check the viewer not clised.
    if ($('#numPages', window.document).text() === '') {
      return
    }

    const colorMap = annoUI.labelInput.getColorMap()

    let annotations = []
    let primaryIndex = -1

    // Primary annotation.
    if (isPrimary) {
      $('#dropdownAnnoPrimary a').each((index, element) => {
        let $elm = $(element)
        if ($elm.find('.fa-check').hasClass('no-visible') === false) {
          let annoPath = $elm.find('.js-annoname').text()

          const annoFile = window.annoPage.getAnnoFile(annoPath)
          if (!annoFile) {
            console.log('ERROR')
            return
          }
          primaryIndex = 0
          annotations.push(annoFile.content)

          let filename = annoFile.name
          localStorage.setItem('_pdfanno_primary_annoname', filename)
          console.log('filename:', filename)
        }
      })
    }

    // Reference annotations.
    if (!isPrimary) {
      $('#dropdownAnnoReference a').each((index, element) => {
        let $elm = $(element)
        if ($elm.find('.fa-check').hasClass('no-visible') === false) {
          let annoPath = $elm.find('.js-annoname').text()

          const annoFile = window.annoPage.getAnnoFile(annoPath)

          if (!annoFile) {
            console.log('ERROR')
            return
          }
          annotations.push(annoFile.content)
        }
      })
    }

    // Create import data.
    let paperData = {
      primary : primaryIndex,
      annotations,
      colorMap
    }

    // Import annotations to Viewer.
    window.annoPage.importAnnotation(paperData, isPrimary)
  }

  /**
   * Get all annotations.
   */
  getAllAnnotations () {
    if (!window.annotationContainer) {
      return []
    }
    return window.annotationContainer.getAllAnnotations()
  }

  /**
   * Get selected annotations.
   */
  getSelectedAnnotations () {
    return window.annotationContainer.getSelectedAnnotations()
  }

  /**
   * Find an annotation by id.
   */
  findAnnotationById (id) {
    return window.annotationContainer.findById(id)
  }

  /**
   * Clear the all annotations from the view and storage.
   */
  clearAllAnnotations () {
    window.annotationContainer.getAllAnnotations().forEach(a => a.destroy())
  }

  /**
   * Add an annotation to the container.
   */
  addAnnotation  (annotation) {
    window.annotationContainer.add(annotation)
  }

  /**
   * Create a new rect annotation.
   */
  createRectAnnotation (options) {
    return window.PDFAnnoCore.default.RectAnnotation.newInstance(options)
  }

  /**
   * Create a new span annotation.
   */
  createSpanAnnotation (options) {
    console.log('createSpanAnnotation:', options)
    return window.PDFAnnoCore.default.SpanAnnotation.newInstance(options)
  }

  /**
   * Create a new relation annotation.
   */
  createRelationAnnotation (options) {
    return window.PDFAnnoCore.default.RelationAnnotation.newInstance(options)
  }

  validateSchemaErrors (errors) {
    let messages = []
    errors.forEach(error => {
      Object.keys(error).forEach(key => {
        let value = error[key]
        value = typeof value === 'object' ? JSON.stringify(value) : value
        messages.push(`${key}: ${value}`)
      })
      messages.push('')
    })
    return messages.join('<br />')
  }

  /**
   * Import annotations from UI.
   */
  importAnnotation (paperData, isPrimary) {
    window.annotationContainer.importAnnotations(paperData, isPrimary).then(() => {
      // Notify annotations added.
      Utils.dispatchWindowEvent('annotationrendered')
    }).catch(errors => {
      let message = errors
      if (Array.isArray(errors)) {
        message = this.validateSchemaErrors(errors)
      }
      annoUI.ui.alertDialog.show({ message })
    })
  }

  /**
   * Scroll window to the annotation.
   */
  scrollToAnnotation (id) {

    let annotation = window.annoPage.findAnnotationById(id)

    if (annotation) {

      // scroll to.
      let pageNumber, y
      if (annotation.type === 'span') {
        pageNumber = annotation.page
        y = annotation.rectangles[0].y
      } else {
        let _y = annotation.y || annotation.y1
        let d = convertToExportY(_y)
        pageNumber = d.pageNumber
        y = d.y
      }
      let pageHeight = window.annoPage.getViewerViewport().height
      let scale = window.annoPage.getViewerViewport().scale
      let _y = (pageHeight + paddingBetweenPages) * (pageNumber - 1) + y * scale
      _y -= 100
      $('#viewer').parent()[0].scrollTop = _y

      // highlight.
      annotation.highlight()
      setTimeout(() => {
        annotation.dehighlight()
      }, 1000)
    }
  }

  /**
   * Get the export data of annotations.
   *
   * @return {Promise}
   */
  exportData ({exportType = 'toml'} = {}) {
    return window.annotationContainer.exportData(...arguments)
  }

  /**
   * Get the viewport of the viewer.
   */
  getViewerViewport () {
    return window.PDFView.pdfViewer.getPageView(0).viewport
  }

  /**
   * Get the content's name displayed now.
   */
  getCurrentContentName () {
    return window.getFileName(window.PDFView.url)
  }

  /**
   * Load PDF data from url.
   * @param {String} url
   * @returns Promise<Uint8Array>
   * @memberof PDFAnnoPage
   */
  loadPdf (url) {
    return fetch(url, {
      method : 'GET',
      mode   : 'cors'
    }).then(response => {
      if (response.ok) {
        return response.arrayBuffer()
      } else {
        // throw new Error(`HTTP ${response.status} - ${response.statusText}`)
        throw new Error(`HTTP ${response.status} - PDFファイルのロードに失敗しました。`)
      }
    }).then(buffer => {
      return new Uint8Array(buffer)
    })
  }

  // loadPdftxt (url) {
  //   this.loadPdf(url).then(data => {
  //     return pako.inflate(data, {to : 'string'})
  //   })
  // }

  /**
   * Load pdftxt data from url.
   * @param {String} url
   * @returns Promise<String>
   * @memberof PDFAnnoPage
   */
  loadPdftxt (url) {
    return fetch(url, {
      method : 'GET',
      mode   : 'cors'
    }).then(response => {
      if (response.ok) {
        return response.arrayBuffer()
      } else {
        // throw new Error(`HTTP ${response.status} - ${response.statusText}`)
        throw new Error(`HTTP ${response.status} - pdftxtファイルのロードに失敗しました。`)
      }
    }).then(buffer => {
      return new Uint8Array(buffer)
    }).then(data => {
      return pako.inflate(data, {to : 'string'})
    })
  }

  /**
   * Load PDF and pdftxt from url.
   * @param {String} url
   * @returns Promise<Object>
   * @memberof PDFAnnoPage
   */
  loadPDFFromServer (url) {
    const pdftxtUrl = url + '.' + PDFEXTRACT_VERSION.replace(/\./g, '-') + '.txt.gz'
    return Promise.all([
      this.loadPdf(url),
      this.loadPdftxt(pdftxtUrl)
    ]).then(results => {
      return {
        pdf           : results[0],
        analyzeResult : results[1]
      }
    })
  }

  /**
   * Load PDF annotaion file from url.
   * @param {String} url
   * @returns Promise<String>
   * @memberof PDFAnnoPage
   */
  loadAnnoFileFromServer (url) {
    return fetch(url, {
      method : 'GET',
      mode   : 'cors'
    }).then(response => {
      if (response.ok) {
        return response.text()
      } else {
        // throw new Error(`HTTP ${response.status} - ${response.statusText}`)
        throw new Error(`HTTP ${response.status} - annotationファイルのロードに失敗しました。`)
      }
    })
  }

  set pdftxt (text) {
    this._pdftxt = text
  }

  get pdftxt () {
    return this._pdftxt
  }

  /**
   * Check annotation changings.
   */
  async checkAnnotationUpdate () {

    // TODO Refactoring. Too Long...

    // prevs.
    const prevAnnotations = this.prevAnnotations
    const prevFileName = this.prevFileName
    const prevLabelMap = this.prevLabelMap

    // current.
    const currentAnnotations = this.getAllAnnotations()
    let currentFileName // = annoUI.downloadButton.getDownloadFileName(this.getCurrentContentName)
    // TODO Refactoring (use in downloadButton)
    (() => {
      let primaryAnnotationName
      $('#dropdownAnnoPrimary a').each((index, element) => {
        let $elm = $(element)
        if ($elm.find('.fa-check').hasClass('no-visible') === false) {
          primaryAnnotationName = $elm.find('.js-annoname').text()
        }
      })
      if (primaryAnnotationName) {
        currentFileName = primaryAnnotationName
        return
      }

      // The name of Content.
      let pdfFileName = this.getCurrentContentFile() && this.getCurrentContentFile().name
      if (!pdfFileName) {
        return
        // TODO pdftxtとannoダウンロードは、Viewerが閉じている時には無効化すべし.
      }
      // let annoName = pdfFileName.replace(/\.pdf$/i, '.anno')
      let annoName = pdfFileName.replace(/\.pdf$/i, '.' + constants.ANNO_FILE_EXTENSION)
      currentFileName = annoName
    })()
    if (!currentFileName) {
      return
    }
    // console.log('currentFileName:', currentFileName)
    // console.log('currentAnnotations:', currentAnnotations.length)

    // Check.
    if (prevAnnotations && prevFileName && currentAnnotations && currentFileName) {

      // TODO test.

      // Check the fileName.
      if (prevFileName !== currentFileName) {
        socket.sendAnnotationUpdated({
          fileName   : currentFileName,
          updated    : `file was changed (${prevFileName} => ${currentFileName}).`,
          userId     : $('#userId').val(),
          annotation : await this.exportData()
        })

        // Check if added.
      } else if (currentAnnotations.length > prevAnnotations.length) {

        // TODO test => OK.

        const adds = currentAnnotations.filter(a => {
          return prevAnnotations.indexOf(a) === -1
        })

        if (adds.length > 0) {
          const ids = adds.map(a => a.uuid)
          socket.sendAnnotationUpdated({
            fileName   : currentFileName,
            updated    : `an annotation(${ids.join(',')}) was added.`,
            userId     : $('#userId').val(),
            annotation : await this.exportData()
          })
        }

        // Check if deleted.
      } else if (currentAnnotations.length < prevAnnotations.length) {

        // TODO test => OK.

        const deletes = prevAnnotations.filter(a => {
          return currentAnnotations.indexOf(a) === -1
        })

        if (deletes.length > 0) {
          const ids = deletes.map(a => a.uuid)
          const messages = ids.map(id => {
            return `an annotation(${id}) was deleted.`
          })
          socket.sendAnnotationUpdated({
            fileName   : currentFileName,
            updated    : messages.join('\n'),
            userId     : $('#userId').val(),
            annotation : await this.exportData()
          })
        }

        // Check if labels are modifed.
      } else {

        const changes = Object.keys(prevLabelMap).filter(uuid => {
          const b = currentAnnotations.filter(aa => uuid === aa.uuid)
          if (b.length > 0) {
            return prevLabelMap[uuid] !== b[0].text
          }
          return false
        })

        if (changes.length > 0) {
          socket.sendAnnotationUpdated({
            fileName   : currentFileName,
            updated    : `an label(${changes.join(',')}) was changed.`,
            userId     : $('#userId').val(),
            annotation : await this.exportData()
          })
        }
      }
    }

    // Save the state.
    this.prevAnnotations = currentAnnotations
    this.prevFileName = currentFileName
    this.prevLabelMap = {}
    currentAnnotations.forEach(a => {
      this.prevLabelMap[a.uuid] = a.text
    })
  }
}
