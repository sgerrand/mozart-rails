require 'rails'
require 'mozart/assert_select' if ::Rails.env.test?
require 'mozart/rails/assets'
require 'mozart/rails/engine' if ::Rails.version >= '3.1'
require 'mozart/rails/railtie'
require 'mozart/rails/version'
