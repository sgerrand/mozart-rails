require 'mozart/rails/version'
require 'open-uri'

module Mozart
  module Rails
    class Assets
      JAVASCRIPT_URLS = {
        :mozart => [
          'http://cdn.bigcommerce.com/mozart/' + Mozart::Rails::MOZART_VERSION + '/mozart.js',
          'http://cdn.bigcommerce.com/mozart/' + Mozart::Rails::MOZART_VERSION + '/mozart.min.js',
        ]
      }
      VENDOR_PATH = 'vendor/assets/javascripts'

      def self.download_vendor_file(url)
        uri = URI.parse(url)
        dest = File.join(self::VENDOR_PATH, File.basename(uri.path))

        begin
          File.open(dest, 'wb') do |f|
            open(url) do |r|
              r.each_line do |line|
                f.puts line
              end
            end
          end
        rescue => e
          puts "Connection to #{url} encountered an unexpected error: #{e.message}"
          raise e
        end
      end
    end
  end
end
