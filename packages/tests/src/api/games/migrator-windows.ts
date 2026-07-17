import { expect } from 'chai'
import { getMigrationModuleUrl } from '../../../../../server/core/initializers/migration-utils.js'

describe('Migration module paths', function () {
  it('converts Windows migration paths to file URLs', function () {
    const moduleUrl = getMigrationModuleUrl('C:\\peertube\\dist\\core\\initializers', '1086-games.js')

    expect(moduleUrl).to.equal('file:///C:/peertube/dist/core/initializers/migrations/1086-games.js')
  })
})
