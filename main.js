const { app, BaseWindow, WebContentsView } = require('electron')

app.whenReady().then(() => {
  const win = new BaseWindow({ width: 1200, height: 800, title: 'Ember' })

  const view = new WebContentsView()
  win.contentView.addChildView(view)
  view.setBounds({ x: 0, y: 0, width: 1200, height: 800 })
  view.webContents.loadURL('https://example.com')

  win.on('resize', () => {
    const [w, h] = win.getContentSize()
    view.setBounds({ x: 0, y: 0, width: w, height: h })
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
