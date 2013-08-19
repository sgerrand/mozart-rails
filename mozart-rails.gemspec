# coding: utf-8
lib = File.expand_path('../lib', __FILE__)
$LOAD_PATH.unshift(lib) unless $LOAD_PATH.include?(lib)
require 'mozart/rails/version'

Gem::Specification.new do |spec|
  spec.name          = "mozart-rails"
  spec.version       = Mozart::Rails::VERSION
  spec.authors       = ["Sasha Gerrand"]
  spec.email         = ["sasha.gerrand@bigcommerce.com"]
  spec.description   = %q{Use Mozart with Rails 3}
  spec.summary       = %q{This gem provides the Mozart JavaScript framework for your Rails 3 application.}
  spec.homepage      = "https://mozart.io"
  spec.license       = "MIT"

  spec.files          = %w{Gemfile LICENSE.txt mozart-rails.gemspec Rakefile README.md}
  spec.files         += Dir.glob('lib/*.rb')
  spec.files         += Dir.glob('lib/**/*.rb')
  spec.files         += Dir.glob('vendor/assets/javascripts/*.js')
  spec.executables   = spec.files.grep(%r{^bin/}) { |f| File.basename(f) }
  spec.test_files    = spec.files.grep(%r{^(test|spec|features)/})
  spec.require_paths = ["lib"]

  spec.add_development_dependency "bundler", "~> 1.3"
  spec.add_development_dependency "ci_reporter"
  spec.add_development_dependency "coveralls"
  spec.add_development_dependency "rake"
  spec.add_development_dependency "minitest", "~> 4.7"
  spec.add_development_dependency "minitest-rails", "~> 0.9"
  spec.add_runtime_dependency "handlebars_assets"
  spec.add_runtime_dependency "jquery-rails"
  spec.add_runtime_dependency "underscore-rails"
end
