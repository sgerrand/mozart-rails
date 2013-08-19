begin
  require 'coveralls'
  Coveralls.wear!
rescue LoadError => e
  raise e unless RUBY_VERSION < '1.9'
end

gem 'minitest'
require 'minitest/autorun'
require 'minitest/pride'

lib = File.expand_path('../../lib', __FILE__)
$LOAD_PATH.unshift(lib) unless $LOAD_PATH.include?(lib)
require 'mozart-rails'
