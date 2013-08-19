require File.expand_path('../boot', __FILE__)

require "action_controller/railtie"
require "action_mailer/railtie"
#require "active_resource/railtie"
require "rails/test_unit/railtie"

require "mozart-rails"

module RailsApp
  class Application < Rails::Application
    # Add additional load paths for your own custom dirs
    config.autoload_paths.reject!{ |p| p =~ /\/app\/(\w+)$/ && !%w(controllers helpers views).include?($1) }

    # Configure sensitive parameters which will be filtered from the log file.
    config.filter_parameters << :password

    config.assets.enabled = false unless defined?(config.assets).nil?
  end
end
