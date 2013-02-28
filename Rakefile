require "bundler/gem_tasks"

task :build => ['files:copy_source', 'files:minify']
task :release => ['files:copy_source', 'files:minify', :guard_version]

task :guard_version do
  def check_version(file, pattern, constant)
    body = File.read("vendor/assets/javascripts/mozart/vendor/scripts/#{file}")
    match = body.match(pattern) or abort "Version check failed: no pattern matched in #{file}"
    file_version = body.match(pattern)[1]
    constant_version = Mozart::Rails.const_get(constant)

    unless constant_version == file_version
      abort "Mozart::Rails::#{constant} was #{constant_version} but it should be #{file_version}"
    end
  end

  check_version("mozart-#{Mozart::Rails::MOZART_VERSION}.js", /version: "([\S]+)"/, 'MOZART_VERSION')
end

namespace :files do
  Mozart::Rails::VENDOR_PATH = "vendor/assets/javascripts/mozart/vendor/scripts"
  Mozart::Rails::ASSETS_PATH = "lib/assets/javascripts/mozart"

  desc "Copy source files into the assets directory"
  task :copy_source do
    require 'fileutils'

    [
      "handlebars-#{Mozart::Rails::HANDLEBARS_VERSION}",
      "jquery-#{Mozart::Rails::JQUERY_VERSION}",
      "mozart-#{Mozart::Rails::MOZART_VERSION}",
      "underscore-#{Mozart::Rails::UNDERSCORE_VERSION}",
    ].each do |file|
      if File.file? File.join(Mozart::Rails::ASSETS_PATH, "#{file.gsub(/-.+/, '')}.js")
        puts "File exists: #{File.join(Mozart::Rails::ASSETS_PATH, "#{file.gsub(/-.+/, '')}.js")}, skipping"
      else
        FileUtils.cp File.join(Mozart::Rails::VENDOR_PATH, "#{file}.js"), File.join(Mozart::Rails::ASSETS_PATH, "#{file.gsub(/-.+/, '')}.js")
      end
    end
  end

  task :minify do
    require 'uglifier'

    puts "Minifying.."
    ["handlebars", "jquery", "mozart", "underscore"].each do |file|
      File.open(File.join(Mozart::Rails::ASSETS_PATH, "#{file}.min.js"), 'w') do |f|
        f.puts Uglifier.compile(File.read("#{File.join(Mozart::Rails::ASSETS_PATH, file)}.js"))
      end
      puts "Minified file: #{file}"
    end
    puts "Done"
  end
end
