require "bundler/gem_tasks"

task :release => [:copy_source_files, :guard_version]

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

desc "Copy source files into the assets directory"
task :copy_source_files do
  require 'fileutils'

  VENDOR_PATH = "vendor/assets/javascripts/mozart/vendor/scripts"
  ASSETS_PATH = "vendor/assets/javascripts"

  [
    "handlebars-#{Mozart::Rails::HANDLEBARS_VERSION}",
    "jquery-#{Mozart::Rails::JQUERY_VERSION}",
    "mozart-#{Mozart::Rails::MOZART_VERSION}",
    "underscore-#{Mozart::Rails::UNDERSCORE_VERSION}",
  ].each do |file|
    if File.file? File.join(ASSETS_PATH, "#{file.gsub(/-.+/, '')}.js")
      puts "File exists: #{File.join(ASSETS_PATH, "#{file.gsub(/-.+/, '')}.js")}, skipping"
    else
      FileUtils.cp File.join(VENDOR_PATH, "#{file}.js"), File.join(ASSETS_PATH, "#{file.gsub(/-.+/, '')}.js")
    end
  end
end
