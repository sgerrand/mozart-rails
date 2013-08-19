require "bundler/gem_tasks"
require "rake/testtask"
require "mozart/rails/assets"

task :build => [:test, :clean, :download]
task :release => [:test, :clean, :download, :guard_version]
task :test => :download
task :default => :test

require "rake/testtask"

Rake::TestTask.new(:test) do |t|
  t.libs << 'test'
  t.pattern = 'test/**/*_test.rb'
  t.verbose = true
end

task :guard_version do
  def check_version(file, pattern, constant)
    body = File.read(Mozart::Rails::Assets::VENDOR_PATH + '/' + file)
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

  Dir.glob(Mozart::Rails::Assets::VENDOR_PATH + "/*.js").each do |file|
    unless file.match(/mozart-all.js$/)
      puts "Removing #{file}"
      File.unlink file
    end
  end
end

desc "Download source files into the assets directory"
task :download do
  Mozart::Rails::Assets::JAVASCRIPT_URLS.each do |key, urls|
    urls.each do |url|
      Mozart::Rails::Assets.download_vendor_file(url)
    end
  end

  [
    'https://raw.github.com/wycats/handlebars.js/master/dist/handlebars.js',
    'https://raw.github.com/wycats/handlebars.js/master/dist/handlebars.runtime.js',
    'https://code.jquery.com/jquery.js',
    'https://code.jquery.com/jquery.min.js',
    'https://raw.github.com/jashkenas/underscore/master/underscore.js',
    'https://raw.github.com/jashkenas/underscore/master/underscore-min.js',
    'https://raw.github.com/jashkenas/underscore/master/underscore-min.map',
  ].each do |url|
    Mozart::Rails::Assets.download_vendor_file(url)
  end
end
