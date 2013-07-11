module Mozart
  module Rails
    class Railtie < ::Rails::Railtie
      config.before_configuration do
        if config.action_view.javascript_expansions
          if ::Rails.root.join("public/javascripts/mozart.js").exist?
            mzrt_defaults = %w(mozart)
            mzrt_defaults.map!{|a| a + ".min" } if ::Rails.env.production? || ::Rails.env.test?
          else
            mzrt_defaults = ::Rails.env.production? || ::Rails.env.test? ? %w(mozart.min) : %w(mozart)
          end
        end
      end
    end
  end
end
