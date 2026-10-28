import { DEFAULT_LABELS } from '../utils/notes'

// Settings screen inside the Zepp app. Values are stored in settingsStorage,
// which the phone-side service (app-side/index.js) reads.
AppSettingsPage({
  state: {
    props: {}
  },

  get(key) {
    return this.state.props.settingsStorage.getItem(key) || ''
  },

  set(key, value) {
    this.state.props.settingsStorage.setItem(key, value)
  },

  input(label, key, placeholder) {
    return TextInput({
      label,
      placeholder,
      value: this.get(key),
      subStyle: { color: '#333', fontSize: '14px' },
      onChange: (val) => this.set(key, String(val).trim())
    })
  },

  build(props) {
    this.state.props = props

    const labelInputs = DEFAULT_LABELS.map((def, i) =>
      this.input('Button ' + (i + 1), 'label' + i, def)
    )

    return View({ style: { padding: '12px 20px' } }, [
      Section(
        {
          title: 'Receiver',
          description: 'Web app URL from Apps Script (ends in /exec) and the token you saved in Script Properties.'
        },
        [
          this.input('Receiver URL', 'receiverUrl', 'https://script.google.com/macros/s/.../exec'),
          this.input('Token', 'token', 'Same value as TOKEN in Script Properties')
        ]
      ),
      Section(
        {
          title: 'Button labels',
          description: 'Leave a field blank to use the default. Short labels (about 10 characters) read best on the watch.'
        },
        labelInputs
      ),
      Section({ title: 'Test' }, [
        Button({
          label: 'Send test note',
          color: 'primary',
          onClick: () => this.set('testRequest', String(Date.now()))
        }),
        Text({ paragraph: true, style: { marginTop: '8px', fontSize: '14px', color: '#555' } }, [
          this.get('testResult') || 'No test sent yet.'
        ])
      ])
    ])
  }
})
