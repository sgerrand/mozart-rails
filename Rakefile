require "bundler/gem_tasks"
require "mozart/rails/assets"

task :build => [:clean, :download]
task :release => [:clean, :download, :guard_version]

task :guard_version do
  def check_version(file, pattern, constant)
    body = File.read(Mozart::Rails::VENDOR_PATH + '/' + file)
    match = body.match(pattern) or abort "Version check failed: no pattern matched in #{file}"
    file_version = match[1]
    constant_version = Mozart::Rails.const_get(constant)

    unless constant_version == file_version
      abort "Mozart::Rails::#{constant} was #{constant_version} but it should be #{file_version}"
    end
  end

  check_version("mozart.min.js", /\/\*\! Mozart v([\S]+)/, 'MOZART_VERSION')
end

desc "Remove JavaScript asset files"
task :clean do
  puts "Removing JavaScript assets"

  Dir.glob(Mozart::Rails::VENDOR_PATH + "/*.js").each do |file|
    unless file.match(/mozart-all.js$/)
      puts "Removing #{file}"
      File.unlink file
    end
  end
end

desc "Download source files into the assets directory"
task :download do
  require 'net/https'

  Mozart::Rails::JAVASCRIPT_URLS.each do |key, urls|
    urls.each do |url|
      uri = URI.parse(url)

      Net::HTTP.start(uri.host, uri.port, :use_ssl => uri.scheme == 'https') do |http|
        request = Net::HTTP::Get.new uri.path
        response = http.request request

        case response
        when Net::HTTPSuccess then
          ext = url.match(/(min).js$/) ? '.min.js' : '.js'
          dest = File.join(Mozart::Rails::VENDOR_PATH, key.to_s + ext)

          puts "Downloading #{url} to #{dest}"

          File.open(dest, 'w+') do |f|
            f.puts response.body
          end
        else
          raise "Unexpected response: #{response.inspect}"
        end
      end
    end
  end
end
