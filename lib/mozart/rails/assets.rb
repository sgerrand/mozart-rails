require 'mozart/rails/version'

module Mozart
  module Rails
    JAVASCRIPT_URLS = {
      :mozart => [
        'http://cdn.bigcommerce.com/mozart/' + Mozart::Rails::MOZART_VERSION + '/mozart.js',
        'http://cdn.bigcommerce.com/mozart/' + Mozart::Rails::MOZART_VERSION + '/mozart.min.js',
      ]
    }
    VENDOR_PATH = 'vendor/assets/javascripts'
  end
end
