require 'minitest_helper'

class Mozart::Rails::RailtieTest < MiniTest::Unit::TestCase
  def test_inherits_from_rails_railtie
    assert Mozart::Rails::Railtie.ancestors.include?(Rails::Railtie)
  end
end
