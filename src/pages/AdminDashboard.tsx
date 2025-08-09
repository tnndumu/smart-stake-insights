import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Plus, Edit, Trash2, Users, CreditCard, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface Bet {
  id: string;
  sport: string;
  home_team: string;
  away_team: string;
  odds: number;
  prediction_confidence: number;
  reasoning: string;
  category: 'regular' | 'premium';
  game_date: string;
  game_time: string;
}

interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
}

const AdminDashboard = () => {
  const [bets, setBets] = useState<Bet[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    sport: '',
    home_team: '',
    away_team: '',
    odds: '',
    prediction_confidence: '',
    reasoning: '',
    category: 'premium' as 'regular' | 'premium',
    game_date: '',
    game_time: '',
  });
  const [editingBet, setEditingBet] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkAdminAccess();
  }, [user]);

  const checkAdminAccess = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (error || profile?.role !== 'admin') {
        toast({
          title: "Access Denied",
          description: "You don't have admin permissions",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      fetchData();
    } catch (error) {
      navigate('/');
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch bets
      const { data: betsData, error: betsError } = await supabase
        .from('bets')
        .select('*')
        .order('created_at', { ascending: false });

      if (betsError) throw betsError;

      // Fetch profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      setBets(betsData || []);
      setProfiles(profilesData || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const betData = {
        ...formData,
        odds: parseFloat(formData.odds),
        prediction_confidence: parseInt(formData.prediction_confidence),
      };

      if (editingBet) {
        const { error } = await supabase
          .from('bets')
          .update(betData)
          .eq('id', editingBet);

        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Bet updated successfully",
        });
      } else {
        const { error } = await supabase
          .from('bets')
          .insert([betData]);

        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Bet created successfully",
        });
      }

      resetForm();
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save bet",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (bet: Bet) => {
    setFormData({
      sport: bet.sport,
      home_team: bet.home_team,
      away_team: bet.away_team,
      odds: bet.odds.toString(),
      prediction_confidence: bet.prediction_confidence.toString(),
      reasoning: bet.reasoning,
      category: bet.category,
      game_date: bet.game_date,
      game_time: bet.game_time,
    });
    setEditingBet(bet.id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this bet?')) return;
    
    try {
      const { error } = await supabase
        .from('bets')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Bet deleted successfully",
      });
      
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to delete bet",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      sport: '',
      home_team: '',
      away_team: '',
      odds: '',
      prediction_confidence: '',
      reasoning: '',
      category: 'premium',
      game_date: '',
      game_time: '',
    });
    setEditingBet(null);
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "User role updated successfully",
      });
      
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update user role",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background/95 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-primary to-warning p-2 rounded-lg">
                <Shield className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-warning bg-clip-text text-transparent">
                  Admin Dashboard
                </h1>
                <p className="text-sm text-muted-foreground">Manage bets and users</p>
              </div>
            </div>
            <Button onClick={fetchData} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="bets" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="bets">Manage Bets</TabsTrigger>
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="stats">Statistics</TabsTrigger>
          </TabsList>
          
          <TabsContent value="bets" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bet Form */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Plus className="h-5 w-5" />
                    <span>{editingBet ? 'Edit Bet' : 'Add New Bet'}</span>
                  </CardTitle>
                  <CardDescription>
                    {editingBet ? 'Update the betting information' : 'Create a new betting prediction'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="sport">Sport</Label>
                        <Select value={formData.sport} onValueChange={(value) => setFormData({...formData, sport: value})}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select sport" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NFL">NFL</SelectItem>
                            <SelectItem value="NBA">NBA</SelectItem>
                            <SelectItem value="MLB">MLB</SelectItem>
                            <SelectItem value="NHL">NHL</SelectItem>
                            <SelectItem value="Soccer">Soccer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="category">Category</Label>
                        <Select value={formData.category} onValueChange={(value) => setFormData({...formData, category: value as 'regular' | 'premium'})}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="regular">Regular</SelectItem>
                            <SelectItem value="premium">Premium</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="home_team">Home Team</Label>
                        <Input
                          id="home_team"
                          value={formData.home_team}
                          onChange={(e) => setFormData({...formData, home_team: e.target.value})}
                          required
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="away_team">Away Team</Label>
                        <Input
                          id="away_team"
                          value={formData.away_team}
                          onChange={(e) => setFormData({...formData, away_team: e.target.value})}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="odds">Odds</Label>
                        <Input
                          id="odds"
                          type="number"
                          step="0.01"
                          value={formData.odds}
                          onChange={(e) => setFormData({...formData, odds: e.target.value})}
                          required
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="prediction_confidence">Confidence (%)</Label>
                        <Input
                          id="prediction_confidence"
                          type="number"
                          min="0"
                          max="100"
                          value={formData.prediction_confidence}
                          onChange={(e) => setFormData({...formData, prediction_confidence: e.target.value})}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="game_date">Game Date</Label>
                        <Input
                          id="game_date"
                          type="date"
                          value={formData.game_date}
                          onChange={(e) => setFormData({...formData, game_date: e.target.value})}
                          required
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="game_time">Game Time</Label>
                        <Input
                          id="game_time"
                          type="time"
                          value={formData.game_time}
                          onChange={(e) => setFormData({...formData, game_time: e.target.value})}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reasoning">Analysis/Reasoning</Label>
                      <Textarea
                        id="reasoning"
                        value={formData.reasoning}
                        onChange={(e) => setFormData({...formData, reasoning: e.target.value})}
                        required
                        rows={3}
                      />
                    </div>

                    <div className="flex space-x-2">
                      <Button type="submit" className="flex-1">
                        {editingBet ? 'Update Bet' : 'Create Bet'}
                      </Button>
                      {editingBet && (
                        <Button type="button" variant="outline" onClick={resetForm}>
                          Cancel
                        </Button>
                      )}
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* Bets List */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Bets</CardTitle>
                  <CardDescription>Manage existing betting predictions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {bets.map((bet) => (
                      <div key={bet.id} className="border border-border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline">{bet.sport}</Badge>
                            <Badge variant={bet.category === 'premium' ? 'default' : 'secondary'}>
                              {bet.category}
                            </Badge>
                          </div>
                          <div className="flex space-x-2">
                            <Button size="sm" variant="outline" onClick={() => handleEdit(bet)}>
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDelete(bet.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <h4 className="font-semibold">{bet.away_team} vs {bet.home_team}</h4>
                        <p className="text-sm text-muted-foreground">
                          {bet.game_date} at {bet.game_time} | Confidence: {bet.prediction_confidence}%
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="users" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>User Management</span>
                </CardTitle>
                <CardDescription>View and manage user accounts</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Full Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profiles.map((profile) => (
                      <TableRow key={profile.id}>
                        <TableCell>{profile.email}</TableCell>
                        <TableCell>{profile.full_name || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant={profile.role === 'admin' ? 'default' : 'secondary'}>
                            {profile.role}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(profile.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Select
                            value={profile.role}
                            onValueChange={(value) => updateUserRole(profile.id, value)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="stats" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Total Bets</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary">{bets.length}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Premium Bets</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-warning">
                    {bets.filter(bet => bet.category === 'premium').length}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Total Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-success">{profiles.length}</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;